from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .repository import ClientRepository
from .schemas import ClientCreate, ClientResponse, ClientUpdate
from .service import CLIENT_SEGMENTS

router = APIRouter(prefix="/clients", tags=["clients"])


def get_client_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ClientRepository:
    return ClientRepository(session)


ClientRepoDep = Annotated[ClientRepository, Depends(get_client_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/segments", response_model=list[str])
def get_client_segments(
    current_user: CurrentUserDep,
):
    """Retorna a lista oficial de segmentos de clientes.

    O front consome esta lista em vez de manter as opções hardcoded,
    garantindo uma única fonte de verdade no backend.
    """
    return CLIENT_SEGMENTS


@router.get("/", response_model=list[ClientResponse])
def get_clients(
    repo: ClientRepoDep,
    current_user: CurrentUserDep,
    session: Annotated[Session, Depends(get_db_session)],
):
    """Retorna clientes cadastrados pelo usuário atual.

    Membro de equipe NÃO recebe os clientes de onde é convidado: ele só
    enxerga as tasks do board (via /tasks/), sem acesso às informações do
    cliente.
    """
    owned_clients = repo.get_by_user(current_user.id)

    return [
        ClientResponse(
            **{k: getattr(c, k) for k in c.__dict__ if not k.startswith("_")},
            role="owner",
        )
        for c in owned_clients
    ]


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_in: ClientCreate,
    repo: ClientRepoDep,
    current_user: CurrentUserDep,
    session: Annotated[Session, Depends(get_db_session)],
):
    """Cria um novo cliente para o usuário atual"""
    new_client = repo.create(client_in, current_user.id)

    # Todo cliente nasce com um time próprio (1:1). O time reúne os membros
    # e convites que acessam as rotinas do cliente.
    from src.modules.team.repository import TeamRepository

    team_repo = TeamRepository(session)
    team_repo.ensure_default_roles()
    team_repo.get_or_create_team(new_client.id, current_user.id)
    session.commit()

    log.info(f"🏢 Cliente criado: {client_in.name} por usuário {current_user.email}")
    return new_client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: UUID,
    client_in: ClientUpdate,
    repo: ClientRepoDep,
    current_user: CurrentUserDep,
):
    """Atualiza dados do cliente"""
    client = repo.get_by_id(client_id, current_user.id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    updated_client = repo.update(client, client_in)
    return updated_client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(client_id: UUID, repo: ClientRepoDep, current_user: CurrentUserDep):
    """Remove um cliente"""
    client = repo.get_by_id(client_id, current_user.id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    repo.delete(client)
