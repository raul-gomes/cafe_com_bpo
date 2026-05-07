from typing import Optional
import httpx

from src.core.config import get_settings
from src.core.logger import log
from src.modules.ai.schemas import BudgetAnalysisInput, ContractInput, SalesScriptInput

settings = get_settings()


class OllamaClient:
    @staticmethod
    async def generate(prompt: str, model: str = "qwen2.5:7b", max_tokens: int = 1000) -> str:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "http://ollama:11434/api/generate",
                    json={
                        "model": model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": max_tokens,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "Não foi possível gerar a resposta.")
        except Exception as e:
            log.error(f"Erro ao gerar com Ollama: {str(e)}")
            return f"Erro ao gerar conteúdo com IA: {str(e)}"


class AIService:
    @staticmethod
    async def analyze_budget(input_data: BudgetAnalysisInput) -> str:
        services_str = ", ".join(input_data.services)
        breakdown_str = ""
        if input_data.breakdown:
            breakdown_items = [f"{k}: R$ {v:,.2f}" for k, v in input_data.breakdown.items()]
            breakdown_str = f"\n\nDETALHAMENTO:\n" + "\n".join(breakdown_items)

        prompt = f"""Você é um consultor especializado em precificação de serviços BPO no Brasil. Analise o seguinte orçamento e forneça feedback construtivo.

DADOS DO ORÇAMENTO:
- Cliente: {input_data.client_name}
- Serviços: {services_str}
- Valor Final: R$ {input_data.final_price:,.2f}{breakdown_str}

Forneça:
1. **Análise de Preço**: O valor está adequado para os serviços propostos? Está muito alto ou muito baixo?
2. **Pontos de Atenção**: Existem riscos ou oportunidades que não foram considerados?
3. **Recomendações**: Sugestões práticas para melhorar a proposta (ajuste de preço, inclusão/exclusão de serviços, etc.)
4. **Argumentos de Venda**: 2-3 argumentos que podem ser usados para justificar o valor ao cliente.

Seja objetivo, use linguagem profissional e formato em markdown."""

        return await OllamaClient.generate(prompt)

    @staticmethod
    async def generate_contract(input_data: ContractInput) -> str:
        services_str = "\n".join([f"- {s}" for s in input_data.services])
        penalty_str = input_data.penalty_clause or "Multa de 30% sobre o valor restante do contrato em caso de rescisão antecipada."
        additional_str = input_data.additional_terms or ""

        prompt = f"""Gere um contrato de prestação de serviços BPO profissional em português brasileiro.

DADOS DO CONTRATO:

CONTRATADA:
- Nome: {input_data.provider_name}
- Empresa: {input_data.provider_company}

CONTRATANTE:
- Nome/Empresa: {input_data.client_name}

SERVIÇOS:
{services_str}

VALOR MENSAL: R$ {input_data.monthly_fee:,.2f}
DURAÇÃO: {input_data.contract_duration_months} meses

CLÁUSULA DE MULTA: {penalty_str}

{f"TERMOS ADICIONAIS:\n{additional_str}" if additional_str else ""}

Gere o contrato com as seguintes seções:
1. Identificação das partes
2. Objeto do contrato
3. Obrigações da contratada
4. Obrigações da contratante
5. Valor e forma de pagamento
6. Prazo de vigência
7. Rescisão e multa
8. Confidencialidade
9. Disposições gerais
10. Foro

Use linguagem jurídica adequada, mas acessível. Formato em markdown."""

        return await OllamaClient.generate(prompt, max_tokens=2000)

    @staticmethod
    async def generate_sales_script(input_data: SalesScriptInput) -> str:
        pain_points_str = "\n".join([f"- {p}" for p in input_data.client_pain_points])
        competitor_str = f"\n\nCONCORRENTES:\n{input_data.competitor_info}" if input_data.competitor_info else ""

        prompt = f"""Você é um especialista em vendas B2B para serviços de BPO. Crie um roteiro de vendas completo e persuasivo.

CONTEXTO:
- Tipo de Serviço: {input_data.service_type}
- Público-alvo: {input_data.target_audience}

DORES DO CLIENTE:
{pain_points_str}

SOLUÇÃO PROPOSTA: {input_data.proposed_solution}

VALOR MENSAL: R$ {input_data.monthly_fee:,.2f}{competitor_str}

Crie um roteiro com:

## 1. Abertura (30 segundos)
- Frase de impacto para captar atenção
- Contextualização da dor

## 2. Diagnóstico (2-3 minutos)
- Perguntas para entender a situação atual
- Como identificar oportunidades

## 3. Apresentação da Solução (3-5 minutos)
- Como o BPO resolve cada dor mencionada
- Benefícios tangíveis e intangíveis

## 4. Proposta de Valor
- Justificativa do investimento
- Comparativo com o custo atual do cliente
- ROI esperado

## 5. Objeções Comuns e Respostas
- Liste 3-4 objeções típicas e como respondê-las

## 6. Fechamento
- Call to action claro
- Próximos passos

Use linguagem natural, profissional mas acessível. Formato em markdown."""

        return await OllamaClient.generate(prompt, max_tokens=1500)
