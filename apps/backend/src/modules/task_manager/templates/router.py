from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from uuid import UUID
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from ..schemas import (
    ActivityTemplateCreate,
    ActivityTemplateUpdate,
    ActivityTemplateResponse,
    ActivityTemplateListItem,
    OverdueTemplateResponse,
    TemplateActivityCreate,
    TemplateActivityUpdate,
    TemplateActivityResponse,
)
from ..templates.repository import TemplateRepository
from ..templates.service import TemplateService
from ..routine_types.repository import RoutineTypeRepository

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_template_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> TemplateService:
    return TemplateService(
        TemplateRepository(session),
        routine_type_repo=RoutineTypeRepository(session),
    )


TemplateServiceDep = Annotated[TemplateService, Depends(get_template_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


# ── Template endpoints ──


@router.get("/templates/", response_model=List[ActivityTemplateListItem])
def list_templates(
    service: TemplateServiceDep, current_user: CurrentUserDep
):
    """Lista todos os templates de atividades do usuário."""
    return service.get_templates(current_user.id)


@router.post(
    "/templates/",
    response_model=ActivityTemplateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_template(
    template_in: ActivityTemplateCreate,
    service: TemplateServiceDep,
    current_user: CurrentUserDep,
):
    """Cria um novo template de atividades."""
    return service.create_template(template_in, current_user.id)


@router.get(
    "/templates/overdue/",
    response_model=List[OverdueTemplateResponse],
)
def list_overdue_templates(
    service: TemplateServiceDep, current_user: CurrentUserDep
):
    """Lista templates com due_date ou recurrence_end_date vencidos."""
    return service.get_overdue_templates(current_user.id)


@router.get("/templates/{template_id}", response_model=ActivityTemplateResponse)
def get_template(
    template_id: UUID, service: TemplateServiceDep, current_user: CurrentUserDep
):
    """Retorna um template com suas atividades."""
    result = service.get_template(template_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return result


@router.put("/templates/{template_id}", response_model=ActivityTemplateResponse)
def update_template(
    template_id: UUID,
    template_in: ActivityTemplateUpdate,
    service: TemplateServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza um template de atividades."""
    try:
        return service.update_template(template_id, current_user.id, template_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: UUID, service: TemplateServiceDep, current_user: CurrentUserDep
):
    """Remove um template de atividades."""
    try:
        service.delete_template(template_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    return None


# ── Template Activities (nested) ──


@router.post(
    "/templates/{template_id}/activities/",
    response_model=TemplateActivityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activity(
    template_id: UUID,
    activity_in: TemplateActivityCreate,
    service: TemplateServiceDep,
    current_user: CurrentUserDep,
):
    """Adiciona uma atividade a um template."""
    try:
        return service.create_activity(template_id, current_user.id, activity_in)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")


@router.put(
    "/templates/{template_id}/activities/{activity_id}",
    response_model=TemplateActivityResponse,
)
def update_activity(
    template_id: UUID,
    activity_id: UUID,
    activity_in: TemplateActivityUpdate,
    service: TemplateServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza uma atividade do template."""
    try:
        return service.update_activity(
            template_id, activity_id, current_user.id, activity_in
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/templates/{template_id}/activities/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_activity(
    template_id: UUID,
    activity_id: UUID,
    service: TemplateServiceDep,
    current_user: CurrentUserDep,
):
    """Remove uma atividade do template."""
    try:
        service.delete_activity(template_id, activity_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    return None


@router.post(
    "/templates/{template_id}/activities/reorder",
    response_model=List[TemplateActivityResponse],
)
def reorder_activities(
    template_id: UUID,
    ordered_ids: list[UUID],
    service: TemplateServiceDep,
    current_user: CurrentUserDep,
):
    """Reordena as atividades de um template."""
    try:
        return service.reorder_activities(template_id, current_user.id, ordered_ids)
    except ValueError:
        raise HTTPException(status_code=404, detail="Template não encontrado")
