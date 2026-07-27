from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from uuid import UUID
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from ..schemas import (
    RoutineTypeCreate,
    RoutineTypeUpdate,
    RoutineTypeResponse,
)
from ..routine_types.repository import RoutineTypeRepository
from ..routine_types.service import RoutineTypeService

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_routine_type_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> RoutineTypeService:
    return RoutineTypeService(RoutineTypeRepository(session))


RTServiceDep = Annotated[RoutineTypeService, Depends(get_routine_type_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/routine-types/", response_model=List[RoutineTypeResponse])
def list_routine_types(service: RTServiceDep, current_user: CurrentUserDep):
    """Lista os tipos de rotina do usuário."""
    return service.list_routine_types(current_user.id)


@router.post(
    "/routine-types/",
    response_model=RoutineTypeResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_routine_type(
    data: RoutineTypeCreate,
    service: RTServiceDep,
    current_user: CurrentUserDep,
):
    """Cria um novo tipo de rotina."""
    return service.create_routine_type(current_user.id, data)


@router.put("/routine-types/{type_id}", response_model=RoutineTypeResponse)
def update_routine_type(
    type_id: UUID,
    data: RoutineTypeUpdate,
    service: RTServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza um tipo de rotina."""
    try:
        return service.update_routine_type(type_id, current_user.id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/routine-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_routine_type(
    type_id: UUID,
    service: RTServiceDep,
    current_user: CurrentUserDep,
):
    """Remove um tipo de rotina (desvincula dos templates)."""
    try:
        service.delete_routine_type(type_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
