from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Annotated, Optional
from uuid import UUID
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user, get_optional_user

from .repository import TeamRepository
from .service import TeamService
from .schemas import (
    InviteCreate,
    InviteBatchResponse,
    TeamListResponse,
    AcceptResponse,
)

router = APIRouter(tags=["team"])


def get_repo(session: Annotated[Session, Depends(get_db_session)]) -> TeamRepository:
    return TeamRepository(session)


RepoDep = Annotated[TeamRepository, Depends(get_repo)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
OptionalUserDep = Annotated[Optional[UserResponse], Depends(get_optional_user)]


@router.post(
    "/clients/{client_id}/invite",
    response_model=InviteBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_collaborator(
    client_id: UUID,
    data: InviteCreate,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Convidar um colaborador para a equipe do cliente."""
    service = TeamService(repo)
    try:
        return service.invite_collaborator(client_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/invitations/accept", response_model=AcceptResponse)
def accept_invitation(
    token: str = Query(...),
    repo: RepoDep = None,
    current_user: OptionalUserDep = None,
):
    """Aceitar um convite com token.

    Se o usuário está logado e o email bate, aceita na hora.
    Se não está logado, retorna status=redirect para o frontend redirecionar.
    """
    if repo is None:
        raise HTTPException(status_code=500, detail="Repository not initialized")

    service = TeamService(repo)
    try:
        user_id = current_user.id if current_user else None
        return service.accept_invitation(token, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/clients/{client_id}/team", response_model=TeamListResponse)
def list_team_members(
    client_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Listar membros da equipe de um cliente."""
    service = TeamService(repo)
    try:
        return service.get_team_members(client_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete(
    "/clients/{client_id}/team/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_team_member(
    client_id: UUID,
    user_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Remover um membro da equipe."""
    service = TeamService(repo)
    try:
        service.remove_member(client_id, user_id, current_user.id)
    except ValueError as e:
        status_code = (
            status.HTTP_403_FORBIDDEN
            if "Apenas o gestor" in str(e)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(e))
