from uuid import UUID

from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)

from .models import Contact
from .repository import ContactRepository
from .schemas import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    OrigemContato,
)


def _to_free_response(contact: Contact) -> ContactResponse:
    """Builds the agenda row of a **free** contact (registered by the BPO)."""
    return ContactResponse(
        id=contact.id,
        nome=contact.nome,
        telefone=contact.telefone,
        email=contact.email,
        empresa=contact.empresa,
        origem="livre",
        tem_pessoa=True,
    )


# `companies.type` is the technical discriminator ("client"/"prospect"); the API
# speaks Portuguese. The mapping lives in one place so the agenda never has two
# voices about the same field.
ORIGEM_POR_TYPE = {COMPANY_TYPE_CLIENT: "cliente", COMPANY_TYPE_PROSPECT: "prospecto"}


def _origin_of_company(company: Company) -> OrigemContato:
    """Maps the company type to the API origin value."""
    return ORIGEM_POR_TYPE[company.type]


def _to_company_contact_response(contact: Contact, company: Company) -> ContactResponse:
    """Agenda row of a company **with** a named person.

    The row **is** the contact: `id` is the contact id — what
    `PATCH /contacts/{id}` edits — and the data comes from it, not from the
    legacy `representante_*` columns. `empresa` is the company record name, which
    only changes in the company record.
    """
    return ContactResponse(
        id=contact.id,
        nome=contact.nome,
        telefone=contact.telefone,
        email=contact.email,
        empresa=company.name,
        origem=_origin_of_company(company),
        tem_pessoa=True,
    )


def _to_company_fallback_response(company: Company) -> ContactResponse:
    """Agenda row of a company with **no** active contact: the company itself.

    A company without a named person shows its own name, phone and email, marked
    as "no person registered" (`tem_pessoa=False`) and not editable here — the
    person is registered in the company record. Holds for a prospect and for a
    client alike: both are `companies`, and the row is born from the company.
    """
    return ContactResponse(
        id=company.id,
        nome=company.name,
        telefone=company.phone,
        email=company.email,
        empresa=company.name,
        origem=_origin_of_company(company),
        tem_pessoa=False,
    )


class ContactService:
    """Contact agenda rules.

    Every read/write is scoped by `user_id` here in the service (the repository
    only receives the user id), so the router never decides authorization and an
    `id` sent by the client never opens access to another person's data.
    """

    def __init__(self, repository: ContactRepository):
        self.repository = repository

    def list_contacts(
        self,
        user_id: UUID,
        search: str | None = None,
        origem: OrigemContato | None = None,
    ) -> list[ContactResponse]:
        """Single listing: free contacts + one row per company of the user.

        A company row is the `Contact` — the person, with the contact id — or,
        when the company has no active contact, the company itself without a
        person. An archived prospect/client still shows: the filter is
        `is_active` of the **contact**, not of the company (product rule §13).

        Ordering happens in Python (lower + origin) so it does not depend on the
        database collation and stays deterministic between Postgres and SQLite.
        """
        rows: list[ContactResponse] = []
        if origem in (None, "livre"):
            rows += [
                _to_free_response(c) for c in self.repository.list_free(user_id, search)
            ]
        if origem in (None, "prospecto", "cliente"):
            rows += [
                _to_company_contact_response(contact, company)
                for contact, company in self.repository.list_company_contacts(
                    user_id, search
                )
            ]
            rows += [
                _to_company_fallback_response(company)
                for company in self.repository.list_companies_without_contact(
                    user_id, search
                )
            ]
            rows = [row for row in rows if origem is None or row.origem == origem]
        return sorted(rows, key=lambda row: (row.nome.lower(), row.origem))

    def create_contact(
        self, contact_in: ContactCreate, user_id: UUID
    ) -> ContactResponse:
        """Creates a free contact for the user and returns its agenda row."""
        return _to_free_response(self.repository.create(contact_in, user_id))

    def update_contact(
        self, contact_id: UUID, contact_in: ContactUpdate, user_id: UUID
    ) -> ContactResponse:
        """Fixes a contact by its id: a free one, or the person of a company.

        Company person: the contact is the source, so the fix lands there and is
        mirrored into the source prospect's `representante_*` columns, which the
        legacy consumers still read. Free contact: only itself. In both, `empresa`
        is ignored — the company name belongs to the company record (rule §13).

        A company without a named person has no contact, hence no id to edit
        through here: its agenda row is the company itself and is read-only.
        """
        contact = self.repository.get_by_id(contact_id, user_id)
        if not contact:
            raise ValueError("Contato não encontrado")
        if contact.company_id is None:
            return _to_free_response(self.repository.update(contact, contact_in))
        company = self.repository.get_company(contact.company_id, user_id)
        if company is None:
            raise ValueError("Contato não encontrado")
        data = contact_in.model_dump(exclude_unset=True)
        data.pop("empresa", None)
        updated = self.repository.update_company_contact(contact, company, data)
        return _to_company_contact_response(updated, company)

    def delete_contact(self, contact_id: UUID, user_id: UUID) -> None:
        """Soft-deletes a contact owned by the user (404-style error otherwise)."""
        contact = self.repository.get_by_id(contact_id, user_id)
        if not contact:
            raise ValueError("Contato não encontrado")
        self.repository.soft_delete(contact)
