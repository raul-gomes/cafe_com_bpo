from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from uuid import UUID
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from ..schemas import (
    ClientTemplateAssignmentCreate,
    ClientTemplateAssignmentResponse,
)
from ..assignments.repository import AssignmentRepository
from ..assignments.service import AssignmentService
from ..templates.repository import TemplateRepository
from ..task.repository import TaskRepository

router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_assignment_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> AssignmentService:
    return AssignmentService(
        AssignmentRepository(session),
        template_repo=TemplateRepository(session),
        task_repo=TaskRepository(session),
    )


AssignmentServiceDep = Annotated[AssignmentService, Depends(get_assignment_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/client-templates/", status_code=status.HTTP_201_CREATED)
def assign_template(
    assignment_in: ClientTemplateAssignmentCreate,
    service: AssignmentServiceDep,
    current_user: CurrentUserDep,
):
    """Vincula um template a um cliente e gera tarefas automaticamente."""
    try:
        result = service.assign_template_to_client(assignment_in, current_user.id)
        log.info(
            f"🚀 Template vinculado ao cliente {assignment_in.client_id} por {current_user.email}"
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/client-templates/",
    response_model=List[ClientTemplateAssignmentResponse],
)
def list_client_assignments(
    client_id: UUID, service: AssignmentServiceDep, current_user: CurrentUserDep
):
    """Lista os templates vinculados a um cliente."""
    return service.get_client_assignments(client_id)


@router.delete(
    "/client-templates/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_client_assignment(
    assignment_id: UUID, service: AssignmentServiceDep, current_user: CurrentUserDep
):
    """Remove o vínculo de um template com um cliente."""
    try:
        service.remove_client_assignment(assignment_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado")
    return None


@router.post("/client-templates/{assignment_id}/regenerate")
def regenerate_client_tasks(
    assignment_id: UUID, service: AssignmentServiceDep, current_user: CurrentUserDep
):
    """Regenera tarefas para o próximo período de um vínculo."""
    try:
        return service.regenerate_client_tasks(assignment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
