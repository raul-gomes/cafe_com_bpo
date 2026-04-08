from src.schemas import PricingCalculateRequest, PricingCalculateResponse, PricingBreakdownSchema
from src.domain import OperationContext, ServiceItem, PricingInput, PricingCalculator

class PricingService:
    """
    Application Service que atua como tradutor e portão entre Pydantic web I/O e a Regra Agnóstica (PricingCalculator).
    Converte e gerencia exceções sistêmicas garantindo controle HTTP apropriado.
    """
    def calculate_pricing(self, request: PricingCalculateRequest) -> PricingCalculateResponse:
        """
        Valida, Converte as Dataclasses de Regra e calcula montado o PricingCalculateResponse.
        
        Args:
            request (PricingCalculateRequest): JSON Body Convertido para objeto Pydantic Seguro.
            
        Returns:
            PricingCalculateResponse: Resposta com validação JSON compatível pronta para a Web.
        """
        operation_ctx = OperationContext(
            total_cost=request.operation.total_cost,
            people_count=request.operation.people_count,
            hours_per_month=request.operation.hours_per_month,
            tax_rate=request.operation.tax_rate
        )
        
        service_items = [
            ServiceItem(
                name=s.name,
                minutes_per_execution=s.minutes_per_execution,
                monthly_quantity=s.monthly_quantity,
                fixed_value=s.fixed_value
            ) for s in request.services
        ]
        
        pricing_input = PricingInput(
            operation=operation_ctx,
            services=service_items,
            desired_profit_margin=request.desired_profit_margin
        )
        
        result = PricingCalculator.calculate_final_price(pricing_input)
        
        breakdown_schema = PricingBreakdownSchema(
            cost_per_hour=result.breakdown.cost_per_hour,
            cost_per_minute=result.breakdown.cost_per_minute,
            service_costs=result.breakdown.service_costs,
            total_service_cost=result.breakdown.total_service_cost,
            profit_amount=result.breakdown.profit_amount,
            tax_amount=result.breakdown.tax_amount
        )
        
        return PricingCalculateResponse(
            final_price=result.final_price,
            breakdown=breakdown_schema,
            assumptions=result.assumptions
        )
