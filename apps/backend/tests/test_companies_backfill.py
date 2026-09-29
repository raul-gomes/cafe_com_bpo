"""Backfill de `companies` a partir de `clients` + `prospects` (Fase 2, expand).

Regras que o teste trava:
- `clients` vira `companies(type='client')` **com o mesmo id** (é o que as
  tarefas/time já referenciam).
- prospecto **convertido** não vira uma segunda empresa: colapsa na empresa do
  cliente, trazendo `converted_at` e o representante.
- prospecto aberto/reprovado vira `companies(type='prospect')` com o mesmo id.
- `representante_*` vira uma linha em `contacts` ligada à empresa, apontada por
  `primary_contact_id`.
- rodar de novo não duplica nada.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest

from src.modules.auth.repository import UserRepository
from src.modules.clients.models import Client
from src.modules.companies.backfill import backfill_companies
from src.modules.companies.models import Company
from src.modules.contacts.models import Contact
from src.modules.prospects.models import Prospect


@pytest.fixture
def user_id(db_session) -> UUID:
    user = UserRepository(db_session).create_user(
        email=f"companies_{uuid4()}@cafe.com",
        password_hash="hash",
        auth_provider="local",
    )
    return user.id


def _client(db_session, user_id, name: str) -> UUID:
    client = Client(
        user_id=user_id,
        name=name,
        cnpj="11.222.333/0001-81",
        phone="11988887777",
        email="financeiro@empresa.com",
        color="#0F172A",
        segment="financeiro",
        street="Rua A",
        number="100",
        city="Sao Paulo",
        state="SP",
    )
    db_session.add(client)
    db_session.commit()
    return client.id


def _prospect(db_session, user_id, name: str, **extra) -> UUID:
    prospect = Prospect(user_id=user_id, name=name, **extra)
    db_session.add(prospect)
    db_session.commit()
    return prospect.id


def _company(db_session, company_id: UUID) -> Company:
    return db_session.get(Company, company_id)


def test_client_becomes_company_with_same_id(db_session, user_id):
    client_id = _client(db_session, user_id, "Castellum Financial")

    report = backfill_companies(db_session)

    company = _company(db_session, client_id)
    assert report.clients_copied == 1
    assert company is not None
    assert company.type == "client"
    assert company.name == "Castellum Financial"
    assert company.cnpj == "11.222.333/0001-81"
    assert company.color == "#0F172A"
    assert company.city == "Sao Paulo"
    assert company.state == "SP"


def test_open_prospect_becomes_prospect_company(db_session, user_id):
    prospect_id = _prospect(db_session, user_id, "Fort Atacadista", segment="varejo")

    backfill_companies(db_session)

    company = _company(db_session, prospect_id)
    assert company.type == "prospect"
    assert company.name == "Fort Atacadista"
    assert company.converted_at is None


def test_converted_pair_collapses_into_the_client_company(db_session, user_id):
    client_id = _client(db_session, user_id, "Castellum Financial")
    prospect_id = _prospect(
        db_session,
        user_id,
        "Castellum prospect (nome antigo)",
        converted_client_id=client_id,
        converted_at=datetime(2026, 9, 23, 17, 41, 34, tzinfo=UTC),
        representante_nome="Maria Souza",
        representante_email="maria@castellum.com",
        representante_telefone="11977776666",
        representante_cpf="12345678901",
        representante_cargo="Diretora Financeira",
    )

    report = backfill_companies(db_session)

    # Uma empresa só: a do cliente, que é quem as tarefas já referenciam.
    assert report.pairs_collapsed == 1
    assert report.prospects_copied == 0
    assert _company(db_session, prospect_id) is None

    company = _company(db_session, client_id)
    assert company.type == "client"
    assert company.name == "Castellum Financial"
    assert company.converted_at is not None


def test_representante_becomes_a_contact_linked_to_the_company(db_session, user_id):
    prospect_id = _prospect(
        db_session,
        user_id,
        "Attractive Company",
        representante_nome="Joao Lima",
        representante_telefone="11966665555",
        representante_email="joao@attractive.com",
        representante_cpf="98765432100",
        representante_cargo="Gerente de Ti",
    )

    report = backfill_companies(db_session)

    assert report.contacts_created == 1
    contact = db_session.query(Contact).one()
    assert contact.nome == "Joao Lima"
    assert contact.telefone == "11966665555"
    assert contact.email == "joao@attractive.com"
    assert contact.cpf == "98765432100"
    assert contact.cargo == "Gerente de Ti"
    assert contact.company_id == prospect_id
    assert _company(db_session, prospect_id).primary_contact_id == contact.id


def test_prospect_without_representante_has_no_primary_contact(db_session, user_id):
    prospect_id = _prospect(db_session, user_id, "Sem Contato")

    backfill_companies(db_session)

    assert _company(db_session, prospect_id).primary_contact_id is None
    assert db_session.query(Contact).count() == 0


def test_is_idempotent(db_session, user_id):
    client_id = _client(db_session, user_id, "Castellum Financial")
    prospect_id = _prospect(
        db_session, user_id, "Aberto", representante_nome="Joao Lima"
    )

    backfill_companies(db_session)
    second = backfill_companies(db_session)

    assert second.clients_copied == 0
    assert second.prospects_copied == 0
    assert second.contacts_created == 0
    assert db_session.query(Company).count() == 2
    assert db_session.query(Contact).count() == 1
    assert _company(db_session, client_id) is not None
    assert _company(db_session, prospect_id) is not None


def test_dangling_conversion_keeps_the_prospect_as_a_company(db_session, user_id):
    """`converted_client_id` apontando para um cliente que não existe não pode
    fazer a empresa sumir: ela vira prospect e o caso entra no relatório."""
    missing_client_id = uuid4()
    prospect_id = _prospect(
        db_session,
        user_id,
        "Conversao Pendente",
        converted_client_id=missing_client_id,
    )

    report = backfill_companies(db_session)

    assert report.dangling_conversions == 1
    assert report.prospects_copied == 1
    assert _company(db_session, prospect_id).type == "prospect"


def test_soft_deleted_rows_are_carried_over(db_session, user_id):
    client = Client(user_id=user_id, name="Arquivada", is_active=False)
    client.deleted_at = datetime(2026, 9, 1, 10, 0, tzinfo=UTC)
    db_session.add(client)
    db_session.commit()

    backfill_companies(db_session)

    company = _company(db_session, client.id)
    assert company.is_active is False
    assert company.deleted_at is not None
