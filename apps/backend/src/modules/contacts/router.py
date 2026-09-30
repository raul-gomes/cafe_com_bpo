"""
Contacts Module - Router

Contact agenda of the BPO (Management › Contacts).

The listing joins three sources without duplicating data: the free contacts
registered here, the contact of each company (prospect or client). The company
person is a `Contact` attached to the company; a company with no person shows
its own phone/email, read-only.

Editing a company row writes to the contact; deletion exists only for a free
contact. Authorization (per-user scope) is resolved in the service.
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
    """Builds the service with a repository bound to the request session."""
    return ContactService(ContactRepository(session))


ServiceDep = Annotated[ContactService, Depends(get_service)]


@router.get("/", response_model=list[ContactResponse])
def list_contacts(
    service: ServiceDep,
    current_user: CurrentUserDep,
    q: Annotated[str | None, Query(max_length=120)] = None,
    origem: Annotated[OrigemContato | None, Query()] = None,
):
    """Contacts of the user: free + company, with search and origin filter."""
    return service.list_contacts(current_user.id, search=q, origem=origem)


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def create_contact(
    contact_in: ContactCreate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    created = service.create_contact(contact_in, current_user.id)
    log.info(f"📇 Contact created: {contact_in.nome} by {current_user.email}")
    return created


@router.patch("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: UUID,
    contact_in: ContactUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Fixes a contact by its id — a free one, or the person of a company.

    A company person arrives with the contact `id`: `contacts` is what holds the
    representative, so editing by `prospect_id` would mean editing by an id that
    is not the agenda row's. A company with no person registered has no contact,
    hence no id here — its row is read-only.
    """
    try:
        updated = service.update_contact(contact_id, contact_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    log.info(f"📇 Contact updated: {contact_id} by {current_user.email}")
    return updated


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(contact_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    try:
        service.delete_contact(contact_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
