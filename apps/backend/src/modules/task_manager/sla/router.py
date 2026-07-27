from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from uuid import UUID
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from ..schemas import (
    ClientSLACreate,
    ClientSLAUpdate,
    ClientSLAResponse,
)
from ..sla.repository import SLARepository
from ..sla.service import SLAService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_sla_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> SLAService:
    return SLAService(SLARepository(session))


SLAServiceDep = Annotated[SLAService, Depends(get_sla_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/sla/", response_model=List[ClientSLAResponse])
def list_client_slas(
    client_id: UUID, service: SLAServiceDep, current_user: CurrentUserDep
):
    """Lista as configurações de SLA de um cliente."""
    return service.get_client_slas(client_id)


@router.post(
    "/sla/", response_model=ClientSLAResponse, status_code=status.HTTP_201_CREATED
)
def create_sla(
    sla_in: ClientSLACreate, service: SLAServiceDep, current_user: CurrentUserDep
):
    """Cria configuração de SLA para um cliente."""
    return service.create_sla(sla_in, current_user.id)


@router.put("/sla/{sla_id}", response_model=ClientSLAResponse)
def update_sla(
    sla_id: UUID,
    sla_in: ClientSLAUpdate,
    service: SLAServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza configuração de SLA."""
    try:
        return service.update_sla(sla_id, current_user.id, sla_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="SLA não encontrado")


@router.delete("/sla/{sla_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sla(sla_id: UUID, service: SLAServiceDep, current_user: CurrentUserDep):
    """Remove configuração de SLA."""
    try:
        service.delete_sla(sla_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="SLA não encontrado")
    return None
