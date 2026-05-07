from pydantic import BaseModel
from typing import Optional


class BudgetAnalysisInput(BaseModel):
    client_name: str
    services: list[str]
    final_price: float
    breakdown: Optional[dict] = None
    input_payload: Optional[dict] = None


class ContractInput(BaseModel):
    provider_name: str
    provider_company: str
    client_name: str
    services: list[str]
    monthly_fee: float
    contract_duration_months: int = 12
    penalty_clause: Optional[str] = None
    additional_terms: Optional[str] = None


class SalesScriptInput(BaseModel):
    service_type: str
    target_audience: str
    client_pain_points: list[str]
    proposed_solution: str
    monthly_price: float
    competitor_info: Optional[str] = None
