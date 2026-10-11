from .domain.engine import (
    OperationContext,
    PricingCalculator,
    PricingInput,
    ServiceItem,
)
from .schemas import (
    PricingBreakdownSchema,
    PricingCalculateRequest,
    PricingCalculateResponse,
    ServiceCostSchema,
)


class PricingService:
    """
    Application Service que atua como tradutor e portão entre Pydantic web I/O e a Regra Agnóstica (PricingCalculator).
    Converte e gerencia exceções sistêmicas garantindo controle HTTP apropriado.
    """

    def calculate_pricing(
        self, request: PricingCalculateRequest
    ) -> PricingCalculateResponse:
        """
        Valida, converte as Dataclasses de Regra e calcula o PricingCalculateResponse.
        """
        pricing_input = self._build_pricing_input(request)
        result = PricingCalculator.calculate_final_price(pricing_input)

        return PricingCalculateResponse(
            final_price=float(result.final_price),
            price_before_discount=float(result.price_before_discount),
            discount_amount=float(result.discount_amount),
            breakdown=PricingBreakdownSchema(
                cost_per_hour=float(result.breakdown.cost_per_hour),
                cost_per_minute=float(result.breakdown.cost_per_minute),
                service_costs=[
                    ServiceCostSchema(
                        name=cost.name,
                        type=cost.type,
                        cost=float(cost.cost),
                        monthly_quantity=cost.monthly_quantity,
                    )
                    for cost in result.breakdown.service_costs
                ],
                total_service_cost=float(result.breakdown.total_service_cost),
                profit_amount=float(result.breakdown.profit_amount),
                tax_amount=float(result.breakdown.tax_amount),
            ),
            assumptions=result.assumptions,
        )

    def build_result_payload(self, request: PricingCalculateRequest) -> dict:
        """Resultado autoritativo no formato gravado no orçamento.

        Traduz a mesma resposta da simulação para um dicionário JSON-safe (só
        números) no formato que o simulador e a geração de contrato já esperam,
        para que o preço persistido seja sempre o calculado no servidor.
        """
        result = self.calculate_pricing(request)
        return {
            "final_price": result.final_price,
            "price_before_discount": result.price_before_discount,
            "discount_amount": result.discount_amount,
            "breakdown": {
                "cost_per_hour": result.breakdown.cost_per_hour,
                "cost_per_minute": result.breakdown.cost_per_minute,
                "service_costs": [
                    cost.model_dump() for cost in result.breakdown.service_costs
                ],
                "total_service_cost": result.breakdown.total_service_cost,
                "profit_amount": result.breakdown.profit_amount,
                "tax_amount": result.breakdown.tax_amount,
            },
        }

    @staticmethod
    def _build_pricing_input(request: PricingCalculateRequest) -> PricingInput:
        """Converte o contrato HTTP nas dataclasses de domínio agnósticas."""
        operation_ctx = OperationContext(
            total_cost=request.operation.total_cost,
            people_count=request.operation.people_count,
            hours_per_month=request.operation.hours_per_month,
            tax_rate=request.operation.tax_rate,
            commission_rate=request.operation.commission_rate,
        )

        service_items = [
            ServiceItem(
                name=service.name,
                type=service.type,
                minutes_per_execution=service.minutes_per_execution,
                monthly_quantity=service.monthly_quantity,
                fixed_value=service.fixed_value,
                active=service.active,
            )
            for service in request.services
        ]

        return PricingInput(
            operation=operation_ctx,
            services=service_items,
            desired_profit_margin=request.desired_profit_margin,
            term_discount=request.term_discount,
        )
