from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.modules.companies.models import COMPANY_TYPE_PROSPECT, Company
from src.modules.prospects.models import Prospect

from .models import Contact
from .schemas import ContactCreate, ContactUpdate


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

    # ── agenda: contatos de empresa + empresas sem contato ──

    def list_company_contacts(
        self, user_id: UUID, search: str | None = None
    ) -> list[tuple[Contact, Company]]:
        """Contatos ligados a uma empresa: a pessoa da linha da agenda.

        `contacts` é a fonte do representante (Fase 4), então a linha da pessoa
        **é** o contato — inclusive o `id`, que é o que o `PATCH /contacts/{id}`
        edita. Arquivar a empresa não tira o contato da agenda (regra §13:
        arquivar é operação de CRM); o que some é o contato removido no
        próprio cadastro, via `is_active`.
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
        """Empresas sem contato ativo: a linha da própria empresa, sem pessoa.

        Regra §13: empresa sem representante nomeado aparece usando nome,
        telefone e e-mail do próprio cadastro, marcada como "sem pessoa
        cadastrada" e somente leitura. Sem esta consulta, essas empresas
        sumiriam da agenda ao virar `contacts` a fonte.
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

    # ── contatos das empresas (fonte única: Contact) ──

    def get_company(self, company_id: UUID, user_id: UUID) -> Company | None:
        """Empresa do contato, escopada por `user_id` (a agenda é por usuário)."""
        return (
            self.session.query(Company)
            .filter(Company.id == company_id, Company.user_id == user_id)
            .first()
        )

    def get_source_prospect(self, company: Company, user_id: UUID) -> Prospect | None:
        """Prospecto que é a fonte da empresa, para espelhar a correção.

        Empresa em prospecção: o próprio prospecto. Empresa convertida: o
        prospecto que a originou — é ele que guarda `representante_*`, o cliente
        não tem essas colunas. Cliente criado direto em Empresas não tem
        prospecto de origem, e não precisa: para ele não existe coluna legada
        para espelhar.
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
        """Grava no contato (fonte) e espelha nas colunas legadas do prospecto.

        O contato é a fonte desde a Fase 4, mas contrato, governança e exportação
        ainda leem `prospects.representante_*`; enquanto essas colunas existirem,
        a correção tem que chegar nas duas — senão a pessoa corrige na agenda e
        o documento sai com o dado velho.

        `empresa` é ignorado aqui de propósito: o nome da empresa pertence ao
        cadastro da empresa (regra §13) e mudá-lo por aqui criaria duas fontes.
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
