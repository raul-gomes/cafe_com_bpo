"""R2 — as FKs passam a apontar para `companies` (escrita dupla, coluna antiga fica).

Duas regras que estes testes travam:

1. **Só cliente tem equipe, rotina, SLA e tarefa.** Não é convenção: a FK
   composta `(company_id, company_type) → companies(id, type)` só casa com
   linha `type='client'`, então prospecto não entra — nem por bug, nem por
   UPDATE.
2. **Nenhuma linha muda de dono.** `company_id` nasce igual ao que a coluna
   antiga apontava, com uma exceção: orçamento/contrato ligado a um prospecto
   **que virou cliente** passa a apontar para a empresa do cliente (o mesmo
   `id`), porque o par colapsou numa linha só.
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlalchemy import CheckConstraint, ForeignKeyConstraint

from src.modules.auth.repository import UserRepository
from src.modules.clients.models import Client
from src.modules.companies.backfill import backfill_companies
from src.modules.companies.models import Company
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.task_manager.models import ClientSLA, ClientTemplateAssignment, Task
from src.modules.team.models import Team
from tests.helpers import pricing_input_for_total

CLIENT_ONLY_TABLES = (Task, Team, ClientSLA, ClientTemplateAssignment)
COMPANY_TABLES = (PricingScenario, Contract)


@pytest.fixture
def sem_espelho_de_empresa():
    """Desliga o espelho `Client/Prospect -> Company` durante o teste.

    A migration roda num processo que **não** importa `src.main`, então os
    listeners de escrita dupla não existem lá — as tabelas legadas chegam
    vazias de `companies`. Sem este desligar, o listener criaria a empresa
    antes do backfill e o teste estaria medindo o caminho errado.
    """
    from sqlalchemy import event

    from src.modules.clients.models import Client
    from src.modules.companies import sync
    from src.modules.prospects.models import Prospect

    removed = []
    for model, fn in (
        (Client, sync._client_becomes_company),
        (Prospect, sync._prospect_becomes_company),
    ):
        event.remove(model, "before_insert", fn)
        removed.append((model, fn))
    yield
    for model, fn in removed:
        event.listen(model, "before_insert", fn)


@pytest.fixture
def user_id(db_session) -> UUID:
    user = UserRepository(db_session).create_user(
        email=f"r2_{uuid4()}@cafe.com",
        password_hash="hash",
        auth_provider="local",
    )
    return user.id


def _client(db_session, user_id) -> UUID:
    client = Client(
        user_id=user_id, name="Castellum Financial", cnpj="11.222.333/0001-81"
    )
    db_session.add(client)
    db_session.commit()
    return client.id


def _prospect(db_session, user_id, **extra) -> UUID:
    prospect = Prospect(user_id=user_id, name="Lead em prospecção", **extra)
    db_session.add(prospect)
    db_session.commit()
    return prospect.id


def _scenario(db_session, user_id, **extra) -> UUID:
    scenario = PricingScenario(
        user_id=user_id,
        client_name="Castellum Financial",
        input_payload=pricing_input_for_total(100.0),
        result_payload={"final_price": 100.0},
        **extra,
    )
    db_session.add(scenario)
    db_session.commit()
    return scenario.id


def _contract(db_session, user_id, **extra) -> UUID:
    contract = Contract(
        user_id=user_id, client_name="Castellum Financial", sections=[], **extra
    )
    db_session.add(contract)
    db_session.commit()
    return contract.id


def _backfill_fks(db_session) -> None:
    """As duas metades do backfill: primeiro as empresas, depois as FKs."""
    from src.modules.companies.fk_backfill import backfill_company_fks

    backfill_companies(db_session)
    backfill_company_fks(db_session)


# --- a regra: só cliente tem equipe/rotina/SLA/tarefa -------------------------


@pytest.mark.parametrize("model", CLIENT_ONLY_TABLES)
def test_client_only_table_carries_the_company_type_column(model):
    columns = model.__table__.columns
    assert "company_id" in columns
    assert "company_type" in columns


@pytest.mark.parametrize("model", CLIENT_ONLY_TABLES)
def test_company_type_is_pinned_to_client(model):
    """A coluna `company_type` não é livre: o CHECK trava em 'client'."""
    checks = [
        constraint
        for constraint in model.__table__.constraints
        if isinstance(constraint, CheckConstraint)
    ]
    pinned = [c for c in checks if "company_type" in str(c.sqltext)]
    assert pinned, f"{model.__tablename__} sem CHECK em company_type"
    assert all("client" in str(c.sqltext) for c in pinned)


@pytest.mark.parametrize("model", CLIENT_ONLY_TABLES)
def test_company_fk_is_composite_with_type(model):
    """A garantia é estrutural: a FK leva o `type` junto, então só casa com
    `companies.type = 'client'`."""
    composite = [
        constraint
        for constraint in model.__table__.constraints
        if isinstance(constraint, ForeignKeyConstraint)
        and [c.name for c in constraint.columns] == ["company_id", "company_type"]
    ]
    assert composite, (
        f"{model.__tablename__} sem FK composta (company_id, company_type)"
    )
    assert list(composite[0].elements)[0].target_fullname == "companies.id"
    assert list(composite[0].elements)[1].target_fullname == "companies.type"


@pytest.mark.parametrize("model", COMPANY_TABLES)
def test_company_tables_accept_prospect_and_client(model):
    """Orçamento e contrato nascem de um prospecto e viram cliente sem perder o
    vínculo — por isso a FK aqui é só por `id`, sem `type`."""
    simple = [
        constraint
        for constraint in model.__table__.constraints
        if isinstance(constraint, ForeignKeyConstraint)
        and [c.name for c in constraint.columns] == ["company_id"]
    ]
    assert simple, f"{model.__tablename__} sem company_id FK simples"
    assert list(simple[0].elements)[0].target_fullname == "companies.id"


# --- o backfill das FKs ------------------------------------------------------


def test_client_child_keeps_its_owner(db_session, user_id):
    client_id = _client(db_session, user_id)
    scenario_id = _scenario(db_session, user_id, client_id=client_id)

    _backfill_fks(db_session)

    assert db_session.get(PricingScenario, scenario_id).company_id == client_id


def test_open_prospect_scenario_points_at_the_prospect_company(db_session, user_id):
    prospect_id = _prospect(db_session, user_id)
    scenario_id = _scenario(db_session, user_id, prospect_id=prospect_id)

    _backfill_fks(db_session)

    company = db_session.get(Company, prospect_id)
    assert company.type == "prospect"
    assert db_session.get(PricingScenario, scenario_id).company_id == prospect_id


def test_converted_prospect_scenario_follows_the_conversion(db_session, user_id):
    """O par colapsou numa linha só (o id do cliente): o orçamento precisa
    apontar para ela, senão ficaria apontando para uma empresa que não existe."""
    client_id = _client(db_session, user_id)
    prospect_id = _prospect(
        db_session,
        user_id,
        converted_client_id=client_id,
        converted_at=datetime(2026, 9, 23, 17, 41, 34, tzinfo=UTC),
    )
    scenario_id = _scenario(db_session, user_id, prospect_id=prospect_id)

    _backfill_fks(db_session)

    assert db_session.get(PricingScenario, scenario_id).company_id == client_id
    assert db_session.get(PricingScenario, scenario_id).client_id is None


def test_contract_follows_the_conversion_too(db_session, user_id):
    client_id = _client(db_session, user_id)
    prospect_id = _prospect(db_session, user_id, converted_client_id=client_id)
    contract_id = _contract(db_session, user_id, prospect_id=prospect_id)

    _backfill_fks(db_session)

    assert db_session.get(Contract, contract_id).company_id == client_id


def test_dangling_conversion_keeps_the_prospect_as_the_owner(db_session, user_id):
    """Conversão apontando para cliente inexistente: a empresa é o prospect, e
    inventar um `company_id` apontando para o vazio seria pior que deixar."""
    prospect_id = _prospect(db_session, user_id, converted_client_id=uuid4())
    scenario_id = _scenario(db_session, user_id, prospect_id=prospect_id)

    _backfill_fks(db_session)

    assert db_session.get(PricingScenario, scenario_id).company_id == prospect_id


def test_unlinked_row_stays_unlinked(db_session, user_id):
    scenario_id = _scenario(db_session, user_id)

    _backfill_fks(db_session)

    assert db_session.get(PricingScenario, scenario_id).company_id is None


def test_client_only_tables_get_company_type_filled(db_session, user_id):
    client_id = _client(db_session, user_id)
    team = Team(owner_id=user_id, client_id=client_id)
    task = Task(user_id=user_id, client_id=client_id, title="Revisar contratos")
    db_session.add_all([team, task])
    db_session.commit()

    _backfill_fks(db_session)

    assert db_session.get(Team, team.id).company_id == client_id
    assert db_session.get(Team, team.id).company_type == "client"
    assert db_session.get(Task, task.id).company_id == client_id
    assert db_session.get(Task, task.id).company_type == "client"


def test_fk_backfill_is_idempotent(db_session, user_id, sem_espelho_de_empresa):
    client_id = _client(db_session, user_id)
    prospect_id = _prospect(db_session, user_id, converted_client_id=client_id)
    scenario_id = _scenario(db_session, user_id, prospect_id=prospect_id)
    task = Task(user_id=user_id, client_id=client_id, title="Revisar contratos")
    db_session.add(task)
    db_session.commit()

    _backfill_fks(db_session)
    from src.modules.companies.fk_backfill import backfill_company_fks

    report = backfill_company_fks(db_session)

    assert report.updated == 0
    assert db_session.get(PricingScenario, scenario_id).company_id == client_id
    assert db_session.get(Task, task.id).company_id == client_id
    assert db_session.get(Company, prospect_id) is None
