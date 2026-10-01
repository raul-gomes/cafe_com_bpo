from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.modules.companies.models import COMPANY_TYPE_PROSPECT, Company
from src.modules.prospects.models import Prospect

from .models import Contact
from .schemas import ContactCreate, ContactUpdate


def _like(term: str) -> str:
    """Search term with the LIKE wildcards escaped."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _search_filter(search: str | None, *columns):
    """Case-insensitive search matching ANY of the given columns (OR).

    `None` when there is no term, so the caller applies no filter at all. The
    LIKE wildcards are escaped: typing 100% does not become "anything".
    """
    if not search or not search.strip():
        return None
    term = f"%{_like(search.strip())}%"
    return or_(*[column.ilike(term, escape="\\") for column in columns])


class ContactRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── free contacts ──

    def list_free(self, user_id: UUID, search: str | None = None) -> list[Contact]:
        """Free contacts of the user (no company attached).

        "Free" = contact with no company. One with `company_id` is the person of
        a company and shows in the listing as prospect/client — without this
        filter the same person appeared twice, once as free and once as company.
        A free contact with `empresa` filled in (free text) is still free: that
        is the BPO writing a company name down without registering it.
        """
        query = self.session.query(Contact).filter(
            Contact.user_id == user_id,
            Contact.is_active,
            Contact.company_id.is_(None),
        )
        search_filter = _search_filter(
            search, Contact.nome, Contact.empresa, Contact.email, Contact.telefone
        )
        if search_filter is not None:
            query = query.filter(search_filter)
        return query.all()

    # ── agenda: company contacts + companies without a contact ──

    def list_company_contacts(
        self, user_id: UUID, search: str | None = None
    ) -> list[tuple[Contact, Company]]:
        """Contacts attached to a company: the person of the agenda row.

        `contacts` is the source of the company representative, so the person's
        row **is** the contact — including the `id` that `PATCH /contacts/{id}`
        edits. Archiving the company does not remove the contact from the agenda
        (rule §13: archiving is a CRM operation); what disappears is the contact
        removed in its own record, via `is_active`.
        """
        query = (
            self.session.query(Contact, Company)
            .join(Company, Company.id == Contact.company_id)
            .filter(Contact.user_id == user_id, Contact.is_active)
        )
        search_filter = _search_filter(
            search,
            Contact.nome,
            Contact.empresa,
            Contact.email,
            Contact.telefone,
            Company.name,
            Company.email,
            Company.phone,
        )
        if search_filter is not None:
            query = query.filter(search_filter)
        return query.all()

    def list_companies_without_contact(
        self, user_id: UUID, search: str | None = None
    ) -> list[Company]:
        """Companies with no active contact: the company row, without a person.

        A company without a named person shows its own name, phone and email,
        marked as "no person registered" and read-only. Without this query those
        companies would vanish from the agenda once `contacts` became the source.
        """
        sem_contato = (
            select(Contact.company_id)
            .where(Contact.company_id == Company.id, Contact.is_active)
            .exists()
        )
        query = self.session.query(Company).filter(
            Company.user_id == user_id, ~sem_contato
        )
        search_filter = _search_filter(
            search, Company.name, Company.email, Company.phone
        )
        if search_filter is not None:
            query = query.filter(search_filter)
        return query.all()

    def list_primary_by_company_ids(
        self, company_ids: list[UUID]
    ) -> dict[UUID, Contact]:
        """Contato principal de cada empresa pedida, em uma única consulta.

        `companies.primary_contact_id` é quem aponta para a pessoa da empresa
        (regra Fase 4). O método é **em lote** de propósito: a listagem de
        prospects monta o payload da tela inteira, e buscar contato por linha
        viraria N+1 — duas consultas por prospecto na tela.

        Args:
            company_ids: Ids das empresas a consultar.

        Returns:
            Mapa `company_id -> Contact` só com as empresas que têm contato
            principal ativo.
        """
        if not company_ids:
            return {}
        rows = (
            self.session.query(Contact.company_id, Contact)
            .join(Company, Company.primary_contact_id == Contact.id)
            .filter(
                Company.id.in_(company_ids),
                Contact.is_active,
                Contact.user_id == Company.user_id,
            )
            .all()
        )
        return {company_id: contact for company_id, contact in rows}

    def get_by_id(self, contact_id: UUID, user_id: UUID) -> Contact | None:
        """Contact of the user itself (scoped by `user_id`, never by the body)."""
        return (
            self.session.query(Contact)
            .filter(
                Contact.id == contact_id,
                Contact.user_id == user_id,
                Contact.is_active,
            )
            .first()
        )

    def create(self, contact_in: ContactCreate, user_id: UUID) -> Contact:
        """Inserts a free contact owned by `user_id` and returns it refreshed."""
        contact = Contact(**contact_in.model_dump(), user_id=user_id)
        self.session.add(contact)
        self.session.commit()
        self.session.refresh(contact)
        return contact

    def update(self, contact: Contact, contact_in: ContactUpdate) -> Contact:
        """Applies the set fields of `contact_in` to a free contact."""
        for field, value in contact_in.model_dump(exclude_unset=True).items():
            setattr(contact, field, value)
        self.session.commit()
        self.session.refresh(contact)
        return contact

    def soft_delete(self, contact: Contact) -> None:
        """Soft delete, like companies and prospects: the row stays in the database."""
        contact.is_active = False
        contact.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    # ── company contacts (single source: Contact) ──

    def get_company(self, company_id: UUID, user_id: UUID) -> Company | None:
        """Company of the contact, scoped by `user_id` (the agenda is per user)."""
        return (
            self.session.query(Company)
            .filter(Company.id == company_id, Company.user_id == user_id)
            .first()
        )

    def get_source_prospect(self, company: Company, user_id: UUID) -> Prospect | None:
        """Prospect that is the legacy source of the company, to mirror the fix.

        Company still being worked: the prospect itself. Converted company: the
        prospect that originated it — it is the one holding `representante_*`,
        the client row has no such columns. A client created directly under
        Companies has no source prospect and needs none: there is no legacy
        column to mirror into.
        """
        if company.type == COMPANY_TYPE_PROSPECT:
            return (
                self.session.query(Prospect)
                .filter(Prospect.id == company.id, Prospect.user_id == user_id)
                .first()
            )
        return (
            self.session.query(Prospect)
            .filter(
                Prospect.converted_client_id == company.id,
                Prospect.user_id == user_id,
            )
            .first()
        )

    def update_company_contact(
        self, contact: Contact, company: Company, data: dict
    ) -> Contact:
        """Writes to the contact (the source) and mirrors into the legacy columns.

        The contact has been the source, but `prospects.representante_*` is still
        read by the contract, the governance export and legacy consumers; while
        those columns exist, the fix has to reach both — otherwise the person
        corrects the phone in the agenda and the document ships the old value.

        `empresa` is ignored on purpose: the company name belongs to the company
        record (rule §13), and changing it here would create a second source.
        """
        valores = {
            campo: valor
            for campo, valor in data.items()
            if campo in ("nome", "email", "telefone", "cargo")
        }
        for campo, valor in valores.items():
            setattr(contact, campo, valor)
        prospect = self.get_source_prospect(company, company.user_id)
        if prospect is not None:
            for campo, valor in valores.items():
                setattr(prospect, f"representante_{campo}", valor)
        self.session.commit()
        self.session.refresh(contact)
        return contact
