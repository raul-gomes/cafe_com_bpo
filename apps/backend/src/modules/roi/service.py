from typing import List, Optional
from uuid import UUID
import httpx

from src.modules.roi.repository import RoiRepository
from src.modules.roi.models import RoiSimulation
from src.modules.roi.schemas import RoiInput, RoiResult, RoiBreakdown
from src.core.config import get_settings
from src.core.logger import log

settings = get_settings()


class RoiEngine:
    @staticmethod
    def calculate(inputs: RoiInput) -> RoiResult:
        current_annual = inputs.current_monthly_cost * 12
        bpo_annual = inputs.bpo_monthly_cost * 12

        error_cost_annual = current_annual * (inputs.error_rate_pct / 100)
        productivity_value = (inputs.current_monthly_cost * 12) * (inputs.productivity_gain_pct / 100)

        total_savings = (current_annual - bpo_annual) + error_cost_annual + productivity_value
        investment = bpo_annual
        net_savings = total_savings
        roi = (net_savings / investment * 100) if investment > 0 else 0

        monthly_bpo = inputs.bpo_monthly_cost
        monthly_savings = net_savings / 12 if monthly_bpo > 0 else 0
        payback = monthly_bpo / (net_savings / 12) if net_savings > 0 and monthly_bpo > 0 else 999

        breakdown = RoiBreakdown(
            current_annual_cost=current_annual,
            bpo_annual_cost=bpo_annual,
            error_cost_savings=round(error_cost_annual, 2),
            productivity_value=round(productivity_value, 2),
            total_annual_savings=round(total_savings, 2),
            investment=round(investment, 2),
            net_savings=round(net_savings, 2),
            roi_percentage=round(roi, 2),
            payback_months=round(min(payback, 999), 1),
        )

        return RoiResult(
            breakdown=breakdown,
            monthly_savings=round(net_savings / 12, 2),
            annual_savings=round(net_savings, 2),
            roi_percentage=round(roi, 2),
            payback_months=round(min(payback, 999), 1),
        )


class RoiService:
    def __init__(self, repository: RoiRepository):
        self.repository = repository

    def calculate(self, inputs: RoiInput) -> RoiResult:
        return RoiEngine.calculate(inputs)

    def save_simulation(
        self,
        user_id: UUID,
        inputs: RoiInput,
        result: RoiResult,
        llm_explanation: Optional[str] = None,
    ) -> RoiSimulation:
        simulation = RoiSimulation(
            user_id=user_id,
            current_monthly_cost=inputs.current_monthly_cost,
            bpo_monthly_cost=inputs.bpo_monthly_cost,
            employees_count=inputs.employees_count,
            hourly_rate=inputs.hourly_rate,
            error_rate_pct=inputs.error_rate_pct,
            productivity_gain_pct=inputs.productivity_gain_pct,
            timeframe_months=inputs.timeframe_months,
            roi_percentage=result.roi_percentage,
            net_savings=result.annual_savings,
            payback_months=result.payback_months,
            annual_savings=result.annual_savings,
            llm_explanation=llm_explanation,
        )
        return self.repository.create(simulation)

    def get_simulations(self, user_id: UUID) -> List[RoiSimulation]:
        return self.repository.get_by_user(user_id)

    def get_simulation(self, simulation_id: UUID, user_id: UUID) -> Optional[RoiSimulation]:
        return self.repository.get_by_id(simulation_id, user_id)

    def delete_simulation(self, simulation_id: UUID, user_id: UUID) -> bool:
        simulation = self.repository.get_by_id(simulation_id, user_id)
        if not simulation:
            return False
        self.repository.delete(simulation)
        return True

    async def generate_llm_explanation(self, inputs: RoiInput, result: RoiResult) -> str:
        prompt = f"""Você é um consultor financeiro especializado em BPO. Analise os resultados de uma simulação de ROI e explique em português brasileiro de forma clara e profissional o que os números significam.

DADOS DA SIMULAÇÃO:
- Custo operacional atual (mensal): R$ {inputs.current_monthly_cost:,.2f}
- Custo com BPO proposto (mensal): R$ {inputs.bpo_monthly_cost:,.2f}
- Funcionários envolvidos: {inputs.employees_count}
- Taxa de erro atual: {inputs.error_rate_pct}%
- Ganho de produtividade estimado: {inputs.productivity_gain_pct}%
- Período de análise: {inputs.timeframe_months} meses

RESULTADOS:
- ROI: {result.roi_percentage}%
- Economia anual: R$ {result.annual_savings:,.2f}
- Payback: {result.payback_months} meses
- Economia mensal: R$ {result.monthly_savings:,.2f}

Forneça:
1. Uma análise executiva (2-3 frases)
2. Interpretação dos principais números
3. Uma recomendação prática

Seja objetivo, use linguagem acessível e formato em markdown."""

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "http://ollama:11434/api/generate",
                    json={
                        "model": "qwen2.5:7b",
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 500,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "Não foi possível gerar a análise.")
        except Exception as e:
            log.error(f"Erro ao gerar explicação LLM para ROI: {str(e)}")
            return "Não foi possível gerar a análise por IA no momento. Os resultados numéricos estão disponíveis acima."
