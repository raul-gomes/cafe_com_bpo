from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.modules.clients.models import Client
from src.modules.prospects.models import Prospect

from .models import Contact
from .schemas import ContactCreate, ContactUpdate, SourceContactUpdate


def _like(term: str) -> str:
    """Termo de busca com os curingas do LIKE escapados."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _search_filter(search: str | None, *columns):
    """Busca case-insensitive que casa em QUALQUER uma das colunas (OR).

    `None` quando não há termo, para o chamador não aplicar filtro nenhum.
    Os curingas do LIKE são escapados: digitar 100% não vira "qualquer coisa".
    """
    if not search or not search.strip():
        return None
    term = f"%{_like(search.strip())}%"
    return or_(*[column.ilike(term, escape="\\") for column in columns])


class ContactRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── contatos livres ──

    def list_free(self, user_id: UUID, search: str | None = None) -> list[Contact]:
        # "Livre" = contato sem empresa. O que tem `company_id` é a pessoa de uma
        # empresa e aparece na listagem como prospecto/cliente — sem este filtro
        # a mesma pessoa saía duas vezes, uma como livre e outra como empresa.
        # Contato livre com `empresa` preenchida (texto) continua livre: é o
        # caso de quem anota a empresa no papel, sem cadastro.
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

    def get_by_id(self, contact_id: UUID, user_id: UUID) -> Contact | None:
        """Contato livre do próprio usuário (escopo por `user_id`, nunca do body)."""
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
        contact = Contact(**contact_in.model_dump(), user_id=user_id)
        self.session.add(contact)
        self.session.commit()
        self.session.refresh(contact)
        return contact

    def update(self, contact: Contact, contact_in: ContactUpdate) -> Contact:
        for field, value in contact_in.model_dump(exclude_unset=True).items():
            setattr(contact, field, value)
        self.session.commit()
        self.session.refresh(contact)
        return contact

    def soft_delete(self, contact: Contact) -> None:
        """Soft delete, igual a clientes e prospectos: o registro não some do banco."""
        contact.is_active = False
        contact.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    # ── contatos das empresas (fonte única: prospects.representante_* + cadastro) ──

    def list_prospect_contacts(
        self, user_id: UUID, search: str | None = None
    ) -> list[tuple[Prospect, Client | None]]:
        """Contatos dos prospectos: em aberto E já convertidos em cliente.

        Não filtra `is_active` de propósito — um prospecto ou cliente arquivado
        continua na agenda (regra do dono do produto): o dado não some da lista
        só porque o cadastro foi arquivado. O `client` pode ser None (prospecto
        em aberto) ou o cliente correspondente (prospecto convertido); a empresa
        que manda é sempre a do cliente quando ele existe.
        """
        query = (
            self.session.query(Prospect, Client)
            .outerjoin(Client, Client.id == Prospect.converted_client_id)
            .filter(
                Prospect.user_id == user_id,
                or_(Client.id.is_(None), Client.user_id == user_id),
            )
        )
        search_filter = _search_filter(
            search,
            Prospect.representante_nome,
            Prospect.representante_email,
            Prospect.representante_telefone,
            Prospect.name,
            Prospect.phone,
            Prospect.email,
            Client.name,
            Client.phone,
            Client.email,
        )
        if search_filter is not None:
            query = query.filter(search_filter)
        return query.all()

    def list_direct_clients(
        self, user_id: UUID, search: str | None = None
    ) -> list[Client]:
        """Clientes criados direto em Empresas, sem prospecto de origem.

        Como `clients` não tem colunas de pessoa, a linha deles só pode trazer o
        telefone/e-mail da empresa (`tem_pessoa=False`).
        """
        convertidos = select(Prospect.converted_client_id).where(
            Prospect.converted_client_id.isnot(None)
        )
        query = self.session.query(Client).filter(
            Client.user_id == user_id,
            Client.id.notin_(convertidos),
        )
        search_filter = _search_filter(search, Client.name, Client.phone, Client.email)
        if search_filter is not None:
            query = query.filter(search_filter)
        return query.all()

    def get_source_prospect(
        self, prospect_id: UUID, user_id: UUID
    ) -> tuple[Prospect, Client | None] | None:
        """Prospecto de origem + cliente (se convertido) de um contato de empresa.

        Só devolve quem tem representante nomeado: empresa sem pessoa cadastrada
        não tem o que editar por aqui. Escopo por `user_id` nos dois lados.
        """
        return (
            self.session.query(Prospect, Client)
            .outerjoin(Client, Client.id == Prospect.converted_client_id)
            .filter(
                Prospect.id == prospect_id,
                Prospect.user_id == user_id,
                Prospect.representante_nome.isnot(None),
                or_(Client.id.is_(None), Client.user_id == user_id),
            )
            .first()
        )

    def update_source_contact(
        self, prospect: Prospect, data: SourceContactUpdate
    ) -> Prospect:
        """Grava no prospecto de origem — o cadastro da empresa continua dono."""
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(prospect, f"representante_{field}", value)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect
