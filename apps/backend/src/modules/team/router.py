from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user, get_optional_user

from .repository import TeamRepository
from .schemas import (
    AcceptResponse,
    InvitationListResponse,
    InvitationResponse,
    InviteBatchResponse,
    InviteCreate,
    TeamListResponse,
)
from .service import TeamService

router = APIRouter(tags=["team"])


def get_repo(session: Annotated[Session, Depends(get_db_session)]) -> TeamRepository:
    return TeamRepository(session)


RepoDep = Annotated[TeamRepository, Depends(get_repo)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
OptionalUserDep = Annotated[UserResponse | None, Depends(get_optional_user)]


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


@router.post(
    "/invitations/{invitation_id}/accept",
    response_model=AcceptResponse,
)
def accept_invitation_by_id(
    invitation_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Aceitar um convite pelo ID (usado na dashboard). Requer login."""
    service = TeamService(repo)
    try:
        return service.accept_invitation_by_id(invitation_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/invitations/{invitation_id}/decline",
    status_code=status.HTTP_200_OK,
)
def decline_invitation_by_id(
    invitation_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Recusar um convite pelo ID (usado na dashboard). Requer login."""
    service = TeamService(repo)
    try:
        service.decline_invitation_by_id(invitation_id, current_user.id)
        return {"status": "declined"}
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


@router.get("/clients/{client_id}/invitations", response_model=InvitationListResponse)
def list_invitations(
    client_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Listar convites do cliente (pendente/aceito/declinado/expirado)."""
    service = TeamService(repo)
    try:
        return service.list_invitations(client_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.post(
    "/clients/{client_id}/invitations/{invitation_id}/resend",
    response_model=InvitationResponse,
)
def resend_invitation(
    client_id: UUID,
    invitation_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Reenviar o email de um convite (renova token + expiração)."""
    service = TeamService(repo)
    try:
        return service.resend_invitation(client_id, invitation_id, current_user.id)
    except ValueError as e:
        status_code = (
            status.HTTP_403_FORBIDDEN
            if "Acesso negado" in str(e)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(e))


@router.delete(
    "/clients/{client_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancel_invitation(
    client_id: UUID,
    invitation_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Cancelar (remover) um convite enviado."""
    service = TeamService(repo)
    try:
        service.cancel_invitation(client_id, invitation_id, current_user.id)
    except ValueError as e:
        status_code = (
            status.HTTP_403_FORBIDDEN
            if "Acesso negado" in str(e)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(e))


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


@router.post(
    "/clients/{client_id}/team/{user_id}/routines/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def grant_routine_to_member(
    client_id: UUID,
    user_id: UUID,
    template_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Conceder o acesso de um membro da equipe a uma rotina."""
    service = TeamService(repo)
    try:
        service.grant_routine_to_member(
            client_id, user_id, template_id, current_user.id
        )
    except ValueError as e:
        status_code = (
            status.HTTP_403_FORBIDDEN
            if "Apenas o gestor" in str(e)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(e))


@router.delete(
    "/clients/{client_id}/team/{user_id}/routines/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_routine_from_member(
    client_id: UUID,
    user_id: UUID,
    template_id: UUID,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    """Revogar o acesso de um membro da equipe a uma rotina."""
    service = TeamService(repo)
    try:
        service.revoke_routine_from_member(
            client_id, user_id, template_id, current_user.id
        )
    except ValueError as e:
        status_code = (
            status.HTTP_403_FORBIDDEN
            if "Apenas o gestor" in str(e)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(status_code=status_code, detail=str(e))
