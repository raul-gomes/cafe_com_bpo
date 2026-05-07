from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated, List
from sqlalchemy.orm import Session
import uuid

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.service import get_current_user
from src.modules.auth.schemas import UserResponse
from src.modules.roi.schemas import RoiInput, RoiResult, RoiSimulationResponse
from src.modules.roi.service import RoiService
from src.modules.roi.repository import RoiRepository

router = APIRouter(prefix="/api/roi", tags=["roi"])


def get_service(session: Annotated[Session, Depends(get_db_session)]) -> RoiService:
    return RoiService(RoiRepository(session))


ServiceDep = Annotated[RoiService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/calculate", response_model=RoiResult)
async def calculate_roi(
    inputs: RoiInput,
    service: ServiceDep,
):
    """Calcula o ROI de uma operação BPO."""
    result = service.calculate(inputs)
    return result


@router.post("/calculate-with-explanation")
async def calculate_roi_with_explanation(
    inputs: RoiInput,
    service: ServiceDep,
):
    """Calcula o ROI e gera explicação com IA."""
    result = service.calculate(inputs)
    explanation = await service.generate_llm_explanation(inputs, result)
    return {
        "result": {
            "breakdown": result.breakdown.model_dump(),
            "monthly_savings": result.monthly_savings,
            "annual_savings": result.annual_savings,
            "roi_percentage": result.roi_percentage,
            "payback_months": result.payback_months,
        },
        "explanation": explanation,
    }


@router.post("/save", response_model=RoiSimulationResponse, status_code=201)
async def save_roi_simulation(
    payload: dict,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Salva uma simulação de ROI."""
    inputs = RoiInput(**payload["input_data"])
    result_data = payload["result_data"]
    llm_explanation = payload.get("llm_explanation")

    result = service.calculate(inputs)
    simulation = service.save_simulation(
        user_id=current_user.id,
        inputs=inputs,
        result=result,
        llm_explanation=llm_explanation,
    )

    log.info(f"📊 Simulação ROI salva por {current_user.email} | ROI: {result.roi_percentage}%")

    return simulation


@router.get("/simulations", response_model=List[RoiSimulationResponse])
def list_simulations(
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Lista todas as simulações de ROI do usuário."""
    simulations = service.get_simulations(current_user.id)
    return simulations


@router.get("/simulations/{simulation_id}", response_model=RoiSimulationResponse)
def get_simulation(
    simulation_id: str,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Obtém uma simulação específica."""
    simulation = service.get_simulation(uuid.UUID(simulation_id), current_user.id)
    if not simulation:
        raise HTTPException(status_code=404, detail="Simulação não encontrada")
    return simulation


@router.delete("/simulations/{simulation_id}", status_code=204)
def delete_simulation(
    simulation_id: str,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Exclui uma simulação de ROI."""
    success = service.delete_simulation(uuid.UUID(simulation_id), current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Simulação não encontrada")
    log.info(f"🗑️ Simulação ROI excluída por {current_user.email}")
