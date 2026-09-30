"""
Contacts Module - Router

Agenda de contatos do BPO (Gestão › Contatos).

A listagem junta três fontes, sem duplicar dado: os contatos livres
cadastrados aqui, o contato de cada prospecto (inclusive o que ainda não virou
cliente) e o contato de cada cliente. O contato de prospecto/cliente é o
representante registrado no cadastro (`prospects.representante_*`); sem
representante, a linha usa o telefone/e-mail da própria empresa.

Edição de linha de empresa grava no cadastro de origem; exclusão existe só para
contato livre. A autorização (escopo por usuário) é resolvida no service.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .repository import ContactRepository
from .schemas import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    OrigemContato,
)
from .service import ContactService

router = APIRouter(prefix="/contacts", tags=["contacts"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


def get_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> ContactService:
    return ContactService(ContactRepository(session))


ServiceDep = Annotated[ContactService, Depends(get_service)]


@router.get("/", response_model=list[ContactResponse])
def list_contacts(
    service: ServiceDep,
    current_user: CurrentUserDep,
    q: Annotated[str | None, Query(max_length=120)] = None,
    origem: Annotated[OrigemContato | None, Query()] = None,
):
    """Contatos do usuário: livres + empresas, com busca e filtro de origem."""
    return service.list_contacts(current_user.id, search=q, origem=origem)


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def create_contact(
    contact_in: ContactCreate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    created = service.create_contact(contact_in, current_user.id)
    log.info(f"📇 Contato criado: {contact_in.nome} por {current_user.email}")
    return created


@router.patch("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: UUID,
    contact_in: ContactUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Corrige um contato pelo id — livre, ou a pessoa de uma empresa.

    A pessoa da empresa vem com `id` do contato (Fase 4): é o `contacts` que
    guarda o representante, então editar por `prospect_id` seria editar por um id
    que não é o da linha da agenda. Empresa sem pessoa cadastrada não tem
    contato, logo não tem id aqui — a linha dela é somente leitura.
    """
    try:
        updated = service.update_contact(contact_id, contact_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    log.info(f"📇 Contato atualizado: {contact_id} por {current_user.email}")
    return updated


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    try:
        service.delete_contact(contact_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
