"""Popular `companies` a partir de `clients` e `prospects` (Fase 2 — expand).

Esta é a fase **aditiva**: cria a tabela nova e preenche, sem tocar nas
colunas antigas (`client_id`/`prospect_id`) e sem apagar nada de `clients` ou
`prospects`. Nada lê `companies` ainda, então a aplicação segue funcionando
igual durante e depois da migration.

Duas regras que a operação tem que respeitar:

1. **O id é o do cliente.** Tarefa, time e SLA já apontam para `clients.id`; se
   a conversão criasse uma empresa nova, todos esses vínculos ficariam órfãos.
2. **Par convertido colapsa.** `prospect.converted_client_id` apontando para um
   cliente que existe significa "são a mesma empresa": uma linha só, com o
   `converted_at` e o representante do prospecto.

Roda dentro da migration do Alembic e é testada na suíte, então o código
testado é exatamente o código que roda na produção.
"""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.modules.clients.models import Client
from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)
from src.modules.contacts.models import Contact
from src.modules.prospects.models import Prospect

# Campos de cadastro idênticos em `clients` e `prospects` (o mesmo subconjunto
# do modelo `Company`): a conversão é uma atribuição, não uma tradução.
CADASTRAL_FIELDS = (
    "name",
    "cnpj",
    "phone",
    "email",
    "color",
    "description",
    "segment",
    "street",
    "number",
    "complement",
    "neighborhood",
    "city",
    "state",
    "cep",
)


@dataclass
class BackfillReport:
    """O que a operação fez — é isso que a migration imprime no log."""

    clients_copied: int = 0
    prospects_copied: int = 0
    pairs_collapsed: int = 0
    contacts_created: int = 0
    already_present: int = 0
    dangling_conversions: int = 0
    failures: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "clientes_copiados": self.clients_copied,
            "prospectos_copiados": self.prospects_copied,
            "pares_colapsados": self.pairs_collapsed,
            "contatos_criados": self.contacts_created,
            "ja_existentes": self.already_present,
            "conversoes_pendentes": self.dangling_conversions,
            "falhas": self.failures,
        }


def _company_from(source, company_type: str) -> Company:
    company = Company(
        id=source.id,
        user_id=source.user_id,
        type=company_type,
        created_at=source.created_at,
        updated_at=source.updated_at,
        deleted_at=source.deleted_at,
        is_active=source.is_active,
    )
    for field_name in CADASTRAL_FIELDS:
        setattr(company, field_name, getattr(source, field_name))
    return company


def _has_representante(prospect: Prospect) -> bool:
    return any(
        getattr(prospect, attr) is not None
        for attr in (
            "representante_nome",
            "representante_email",
            "representante_telefone",
            "representante_cpf",
            "representante_cargo",
        )
    )


def _representante_to_contact(prospect: Prospect, company: Company) -> Contact:
    return Contact(
        id=uuid.uuid4(),
        user_id=prospect.user_id,
        company_id=company.id,
        nome=prospect.representante_nome or company.name,
        telefone=prospect.representante_telefone,
        email=prospect.representante_email,
        empresa=company.name,
        cpf=prospect.representante_cpf,
        cargo=prospect.representante_cargo,
    )


def backfill_companies(session: Session) -> BackfillReport:
    """Cria/popula `companies` a partir das duas tabelas legadas.

    Idempotente: uma empresa que já existe é pulada, então a migration pode ser
    reexecutada sem duplicar linha nem perder a última alteração.
    """
    report = BackfillReport()
    existing = set(session.scalars(select(Company.id)))
    client_ids = set(session.scalars(select(Client.id)))

    for client in session.scalars(select(Client)):
        if client.id in existing:
            report.already_present += 1
            continue
        session.add(_company_from(client, COMPANY_TYPE_CLIENT))
        report.clients_copied += 1
    session.flush()

    for prospect in session.scalars(select(Prospect)):
        converted_to = prospect.converted_client_id
        collapsed = converted_to is not None and converted_to in client_ids

        if collapsed:
            report.pairs_collapsed += 1
            # A empresa do cliente já está em `companies` (passo anterior). O que
            # o prospecto sabe de melhor é quando virou cliente e quem é o
            # representante — e esse contato ainda não existe.
            company = session.get(Company, converted_to)
            if company is not None and company.converted_at is None:
                company.converted_at = prospect.converted_at
            if company is not None and _has_representante(prospect):
                contact = _representante_to_contact(prospect, company)
                session.add(contact)
                session.flush()
                if company.primary_contact_id is None:
                    company.primary_contact_id = contact.id
                report.contacts_created += 1
            continue

        if converted_to is not None:
            # Cliente apontado não existe: a empresa não pode sumir, então ela
            # entra como prospect e o caso vai para o relatório.
            report.dangling_conversions += 1

        if prospect.id in existing:
            report.already_present += 1
            continue
        company = _company_from(prospect, COMPANY_TYPE_PROSPECT)
        company.converted_at = prospect.converted_at
        company.reproved_at = prospect.reproved_at
        session.add(company)
        report.prospects_copied += 1
        if _has_representante(prospect):
            contact = _representante_to_contact(prospect, company)
            session.add(contact)
            session.flush()
            company.primary_contact_id = contact.id
            report.contacts_created += 1
        existing.add(prospect.id)

    session.flush()
    return report
