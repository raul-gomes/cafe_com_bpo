from fastapi import APIRouter, Depends
from typing import Annotated

from src.modules.auth.service import get_current_user
from src.modules.auth.schemas import UserResponse
from src.modules.ai.schemas import BudgetAnalysisInput, ContractInput, SalesScriptInput
from src.modules.ai.service import AIService
from src.core.logger import log

router = APIRouter(prefix="/api/ai", tags=["ai"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/analyze-budget")
async def analyze_budget(
    input_data: BudgetAnalysisInput,
    current_user: CurrentUserDep,
):
    """Analisa um orçamento com IA e fornece feedback."""
    log.info(f"🤖 Análise de orçamento solicitada por {current_user.email} | Cliente: {input_data.client_name}")
    result = await AIService.analyze_budget(input_data)
    return {"analysis": result}


@router.post("/generate-contract")
async def generate_contract(
    input_data: ContractInput,
    current_user: CurrentUserDep,
):
    """Gera um contrato de prestação de serviços BPO."""
    log.info(f"🤖 Contrato gerado por {current_user.email} | Cliente: {input_data.client_name}")
    result = await AIService.generate_contract(input_data)
    return {"contract": result}


@router.post("/generate-sales-script")
async def generate_sales_script(
    input_data: SalesScriptInput,
    current_user: CurrentUserDep,
):
    """Gera um roteiro de vendas para serviços BPO."""
    log.info(f"🤖 Roteiro de vendas gerado por {current_user.email}")
    result = await AIService.generate_sales_script(input_data)
    return {"script": result}
