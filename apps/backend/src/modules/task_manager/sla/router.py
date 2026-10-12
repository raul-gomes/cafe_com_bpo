from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from ..schemas import (
    ClientSLACreate,
    ClientSLAResponse,
    ClientSLAUpdate,
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


@router.get("/sla/", response_model=list[ClientSLAResponse])
def list_client_slas(
    client_id: UUID, service: SLAServiceDep, current_user: CurrentUserDep
):
    """Lists the SLAs of a company owned by the caller.

    Args:
        client_id: Company id.
        service: The SLA service.
        current_user: The caller.

    Returns:
        The SLAs.

    Raises:
        HTTPException: 404 when the company is not the caller's.
    """
    try:
        return service.get_client_slas(client_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")


@router.post(
    "/sla/", response_model=ClientSLAResponse, status_code=status.HTTP_201_CREATED
)
def create_sla(
    sla_in: ClientSLACreate, service: SLAServiceDep, current_user: CurrentUserDep
):
    """Creates an SLA for a company owned by the caller.

    Args:
        sla_in: Company, process and days.
        service: The SLA service.
        current_user: The caller.

    Returns:
        The new SLA.

    Raises:
        HTTPException: 404 when the company is not the caller's.
    """
    try:
        return service.create_sla(sla_in, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")


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
        service.delete_sla(sla_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="SLA não encontrado")
