from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .models import Client
from .schemas import ClientCreate, ClientUpdate, ClientResponse
from .repository import ClientRepository

router = APIRouter(prefix="/clients", tags=["clients"])

def get_client_repository(session: Annotated[Session, Depends(get_db_session)]) -> ClientRepository:
    return ClientRepository(session)

ClientRepoDep = Annotated[ClientRepository, Depends(get_client_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]

@router.get("/", response_model=List[ClientResponse])
def get_clients(
    repo: ClientRepoDep,
    current_user: CurrentUserDep
):
    """Retorna clientes cadastrados pelo usuário atual"""
    return repo.get_by_user(current_user.id)

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    client_in: ClientCreate,
    repo: ClientRepoDep,
    current_user: CurrentUserDep
):
    """Cria um novo cliente para o usuário atual"""
    new_client = repo.create(client_in, current_user.id)
    log.info(f"🏢 Cliente criado: {client_in.name} por usuário {current_user.email}")
    return new_client

@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: UUID,
    client_in: ClientUpdate,
    repo: ClientRepoDep,
    current_user: CurrentUserDep
):
    """Atualiza dados do cliente"""
    client = repo.get_by_id(client_id, current_user.id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    updated_client = repo.update(client, client_in)
    return updated_client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: UUID,
    repo: ClientRepoDep,
    current_user: CurrentUserDep
):
    """Remove um cliente"""
    client = repo.get_by_id(client_id, current_user.id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    repo.delete(client)
    return None
