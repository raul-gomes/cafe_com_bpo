from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class RoiInput(BaseModel):
    current_monthly_cost: float
    bpo_monthly_cost: float
    employees_count: int = 1
    hourly_rate: float = 50.0
    error_rate_pct: float = 0.0
    productivity_gain_pct: float = 0.0
    timeframe_months: int = 12


class RoiBreakdown(BaseModel):
    current_annual_cost: float
    bpo_annual_cost: float
    error_cost_savings: float
    productivity_value: float
    total_annual_savings: float
    investment: float
    net_savings: float
    roi_percentage: float
    payback_months: float


class RoiResult(BaseModel):
    breakdown: RoiBreakdown
    monthly_savings: float
    annual_savings: float
    roi_percentage: float
    payback_months: float


class RoiSimulationCreate(BaseModel):
    input_data: dict
    result_data: dict
    llm_explanation: Optional[str] = None


class RoiSimulationResponse(BaseModel):
    id: UUID
    roi_percentage: float
    net_savings: float
    payback_months: float
    annual_savings: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
