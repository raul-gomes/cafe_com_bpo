from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

ZERO = Decimal(0)

ServiceType = Literal["time", "fixed"]


class OperationContextSchema(BaseModel):
    """
    Sub-contexto validador Pydantic de Operação.

    As alíquotas são percentuais (ex.: 6 = 6%), na mesma escala do formulário do
    simulador, para que o cálculo do servidor e o do formulário partam da mesma
    unidade.
    """

    total_cost: Decimal = Field(
        ..., ge=0, description="Custo base financeiro da operação mensal."
    )
    people_count: int = Field(
        ..., gt=0, description="Número de pessoas preenchendo a capacidade computada."
    )
    hours_per_month: Decimal = Field(
        ..., gt=0, description="Carga trabalhada mensal média do pacote."
    )
    tax_rate: Decimal = Field(
        ...,
        ge=0,
        le=100,
        description="Alíquota de imposto em percentual (ex.: 6 para 6%).",
    )
    commission_rate: Decimal = Field(
        default=ZERO,
        ge=0,
        le=100,
        description="Comissão comercial em percentual (ex.: 5 para 5%).",
    )


class ServiceItemSchema(BaseModel):
    """
    Sub-contexto validador de Item de Serviço (Processos do BPO).

    `type` decide o cálculo (tempo × quantidade ou valor fixo × quantidade) e
    `active` permite manter um serviço no formulário sem cobrá-lo.
    """

    name: str = Field(
        ..., min_length=1, description="Nome referencial amigável do serviço."
    )
    type: ServiceType = Field(
        default="time",
        description="'time' cobra por minutos de execução; 'fixed' cobra valor fixo.",
    )
    minutes_per_execution: Decimal = Field(
        default=ZERO, ge=0, description="Tempo médio gasto para cada rotina em minutos."
    )
    monthly_quantity: int = Field(
        default=0, ge=0, description="Volume da requisição estimado no mês."
    )
    fixed_value: Decimal | None = Field(
        default=None,
        ge=0,
        description="Valor fixo por execução, multiplicado pela quantidade mensal.",
    )
    active: bool = Field(
        default=True, description="Serviços inativos não entram no preço."
    )


class PricingCalculateRequest(BaseModel):
    """
    Schema mestre de Entrada. Recebe os HTTP POST das requisições Web com validadores agnósticos.
    """

    operation: OperationContextSchema
    services: list[ServiceItemSchema] = Field(
        ..., min_length=1, description="Listagem de no mínimo um serviço orçado."
    )
    desired_profit_margin: Decimal = Field(
        ...,
        ge=0,
        description="Margem de lucro fracionada (ex.: 0.2 para 20%).",
    )
    term_discount: Decimal = Field(
        default=ZERO,
        ge=0,
        description="Desconto de prazo fracionado (ex.: 0.1 para 10%).",
    )


class ServiceCostSchema(BaseModel):
    """Custo apurado de um serviço, com a identidade usada nos contratos."""

    name: str
    type: ServiceType
    cost: float
    monthly_quantity: int


class PricingBreakdownSchema(BaseModel):
    """
    Breakdown da Resposta. Fornece transparência à API sobre as frações construídas.

    Os valores são expostos como `float` de propósito: o JSON precisa entregar
    números (o Pydantic serializa `Decimal` como string) e os montantes já vêm
    quantizados a centavos do motor de domínio.
    """

    cost_per_hour: float
    cost_per_minute: float
    service_costs: list[ServiceCostSchema]
    total_service_cost: float
    profit_amount: float
    tax_amount: float


class PricingCalculateResponse(BaseModel):
    """
    Schema mestre de Resposta.
    """

    final_price: float
    price_before_discount: float
    discount_amount: float
    breakdown: PricingBreakdownSchema
    assumptions: dict
