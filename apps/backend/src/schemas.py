from pydantic import BaseModel, Field, EmailStr
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

class OperationContextSchema(BaseModel):
    """
    Sub-contexto validador Pydantic de Operação.
    Garante conversão da API para restrições numéricas coerentes.
    """
    total_cost: Decimal = Field(..., ge=0, description="Custo base financeiro da operação mensal.")
    people_count: int = Field(..., gt=0, description="Número de pessoas preenchendo a capacidade computada.")
    hours_per_month: Decimal = Field(..., gt=0, description="Carga trabalhada mensal média do pacote.")
    tax_rate: Decimal = Field(..., ge=0, lt=1, description="Conversão da aliquota do simples/lucro para fator decimal (ex: 0.1 para 10%).")

class ServiceItemSchema(BaseModel):
    """
    Sub-contexto validador de Item de Serviço (Processos do BPO).
    """
    name: str = Field(..., min_length=1, description="Nome referencial amigável do serviço.")
    minutes_per_execution: Decimal = Field(..., ge=0, description="Tempo médio gasto para cada rotina em minutos.")
    monthly_quantity: int = Field(..., ge=0, description="Volume da requisição estimado no mês.")
    fixed_value: Optional[Decimal] = Field(default=None, ge=0, description="Proteção de Forçar Preço Fixo absoluto que substitui o calculo de tempo por minuto.")

class PricingCalculateRequest(BaseModel):
    """
    Schema mestre de Entrada. Recebe os HTTP POST das requisições Web com validadores agnósticos.
    """
    operation: OperationContextSchema
    services: List[ServiceItemSchema] = Field(..., min_length=1, description="Listagem de no mínimo um serviço orçado.")
    desired_profit_margin: Decimal = Field(..., ge=0, description="Percentual como fator exigido de lucro na operação (Markup).")

class PricingBreakdownSchema(BaseModel):
    """
    Breakdown da Resposta. Fornece transparência à API sobre as frações construídas.
    """
    cost_per_hour: Decimal
    cost_per_minute: Decimal
    service_costs: List[Decimal]
    total_service_cost: Decimal
    profit_amount: Decimal
    tax_amount: Decimal

class PricingCalculateResponse(BaseModel):
    """
    Schema mestre de Resposta.
    """
    final_price: Decimal
    breakdown: PricingBreakdownSchema
    assumptions: dict

class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="E-mail principal do usuário.")
    password: str = Field(..., min_length=8, description="Senha forte.")
    name: Optional[str] = Field(default=None, max_length=150, description="Nome completo do usuário.")
    company: Optional[str] = Field(default=None, max_length=150, description="Empresa do usuário.")

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: Optional[str] = None
    company: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
