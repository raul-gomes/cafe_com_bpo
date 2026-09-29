"""R2 — escrita dupla: toda linha nasce com as duas colunas preenchidas.

Enquanto `client_id`/`prospect_id` não saem (R4), cada linha nova precisa
nascer com o `company_id` já certo — senão a leitura migrada na release
seguinte encontra buraco. Fazer isso em listener de ORM (e não em cada
`create`) é o que garante que nenhum caminho de escrita对新 linha esqueça:
o gerador de rotinas, a finalização de contrato e o cadastro manual escrevem
todos pelo mesmo lugar.
"""

from uuid import UUID, uuid4

import pytest

from src.modules.auth.repository import UserRepository
from src.modules.clients.models import Client
from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.task_manager.models import Task
from tests.helpers import pricing_input_for_total


@pytest.fixture
def user_id(db_session) -> UUID:
    user = UserRepository(db_session).create_user(
        email=f"dual_{uuid4()}@cafe.com",
        password_hash="hash",
        auth_provider="local",
    )
    return user.id


def _client(db_session, user_id, name="Castellum Financial") -> Client:
    client = Client(user_id=user_id, name=name)
    db_session.add(client)
    db_session.commit()
    return client


def _prospect(db_session, user_id, name="Lead") -> Prospect:
    prospect = Prospect(user_id=user_id, name=name)
    db_session.add(prospect)
    db_session.commit()
    return prospect


def _scenario(db_session, user_id, **extra) -> PricingScenario:
    scenario = PricingScenario(
        user_id=user_id,
        client_name="X",
        input_payload=pricing_input_for_total(100.0),
        result_payload={"final_price": 100.0},
        **extra,
    )
    db_session.add(scenario)
    db_session.commit()
    return scenario


def _contract(db_session, user_id, **extra) -> Contract:
    contract = Contract(user_id=user_id, client_name="X", sections=[], **extra)
    db_session.add(contract)
    db_session.commit()
    return contract


# --- o pai ganha a empresa junto --------------------------------------------


def test_new_client_is_also_a_company(db_session, user_id):
    client = _client(db_session, user_id)

    company = db_session.get(Company, client.id)
    assert company is not None
    assert company.type == COMPANY_TYPE_CLIENT
    assert company.name == "Castellum Financial"


def test_new_prospect_is_also_a_company(db_session, user_id):
    prospect = _prospect(db_session, user_id)

    company = db_session.get(Company, prospect.id)
    assert company.type == COMPANY_TYPE_PROSPECT
    assert company.name == "Lead"


def test_two_clients_do_not_collide_on_one_company(db_session, user_id):
    first = _client(db_session, user_id, "Castellum")
    second = _client(db_session, user_id, "Forte Atacadista")

    assert db_session.query(Company).count() == 2
    assert db_session.get(Company, first.id).name == "Castellum"
    assert db_session.get(Company, second.id).name == "Forte Atacadista"


# --- os filhos nascem com o dono --------------------------------------------


def test_task_gets_company_id_on_create(db_session, user_id):
    client = _client(db_session, user_id)
    task = Task(user_id=user_id, client_id=client.id, title="Revisar contratos")
    db_session.add(task)
    db_session.commit()

    assert task.company_id == client.id
    assert task.company_type == COMPANY_TYPE_CLIENT


def test_scenario_of_a_prospect_gets_the_prospect_company(db_session, user_id):
    prospect = _prospect(db_session, user_id)
    scenario = _scenario(db_session, user_id, prospect_id=prospect.id)

    assert scenario.company_id == prospect.id


def test_contract_of_a_prospect_gets_the_prospect_company(db_session, user_id):
    prospect = _prospect(db_session, user_id)
    contract = _contract(db_session, user_id, prospect_id=prospect.id)

    assert contract.company_id == prospect.id


def test_row_without_owner_stays_without_company(db_session, user_id):
    """Orçamento avulso é legítimo: não tem dono, e não é para inventar um."""
    scenario = _scenario(db_session, user_id)

    assert scenario.company_id is None


def test_orphan_reference_is_not_written(db_session, user_id):
    """`client_id` que não é empresa (não passou pela criação normal) não pode
    virar `company_id` apontando para o vazio — a linha fica sem dono e a
    anomalia aparece no log, em vez de uma FK quebrada silenciosa."""
    task = Task(user_id=user_id, client_id=uuid4(), title="Tarefa com cliente fantasma")
    db_session.add(task)
    db_session.commit()

    assert task.company_id is None
    assert task.client_id is not None


# --- a conversão move o dono dos filhos --------------------------------------


def test_converting_a_prospect_moves_its_children_to_the_client_company(
    db_session, user_id
):
    """O par colapsa numa empresa só. Os filhos que nasceram apontados para o
    prospecto precisam acompanhar — senão o contrato fica órfão no momento
    exato em que a empresa vira cliente."""
    from datetime import UTC, datetime

    from src.modules.companies.sync import collapse_prospect_into_client

    prospect = _prospect(db_session, user_id)
    scenario = _scenario(db_session, user_id, prospect_id=prospect.id)
    contract = _contract(db_session, user_id, prospect_id=prospect.id)
    client = _client(db_session, user_id)

    collapse_prospect_into_client(
        db_session, prospect, client, datetime(2026, 9, 29, 12, 0, tzinfo=UTC)
    )
    db_session.commit()

    assert db_session.get(Company, prospect.id) is None
    assert db_session.get(PricingScenario, scenario.id).company_id == client.id
    assert db_session.get(Contract, contract.id).company_id == client.id
    assert db_session.get(Company, client.id).converted_at is not None
    assert prospect.converted_client_id == client.id
    # As colunas legadas continuam intactas: elas valem até R4.
    assert db_session.get(PricingScenario, scenario.id).prospect_id == prospect.id
    assert prospect.converted_at is not None


def test_reproving_a_prospect_marks_its_company_as_lost(db_session, user_id):
    """A classificação do negócio vive na empresa depois do cutover da leitura.

    `mark_reproved` precisa marcar a `Company`: se só a flag legada mudasse, o
    filtro de listagem — que vai ler de `companies` — continuaria mostrando o
    orçamento de um negócio não captado, contra a regra "negócios captados somem
    das listagens normais"."""
    from src.modules.companies.models import Company
    from src.modules.prospects.repository import ProspectRepository

    _client(db_session, user_id)
    prospect = _prospect(db_session, user_id, name="Lead Aberto")
    company = db_session.get(Company, prospect.id)

    ProspectRepository(db_session).mark_reproved(prospect)

    db_session.refresh(company)
    assert company.reproved_at is not None


def test_going_back_to_negotiation_clears_the_company_flag(db_session, user_id):
    """Reprovar é uma flag binária e tem volta: o botão "Voltar à negociação"
    precisa devolver a empresa à negociação, senão o negócio continua invisível
    para sempre."""
    from src.modules.companies.models import Company
    from src.modules.prospects.repository import ProspectRepository

    prospect = _prospect(db_session, user_id, name="Lead Aberto")
    repository = ProspectRepository(db_session)
    repository.mark_reproved(prospect)
    company = db_session.get(Company, prospect.id)
    db_session.refresh(company)
    assert company.reproved_at is not None

    repository.clear_reproved(prospect)

    db_session.refresh(company)
    assert company.reproved_at is None


def test_every_active_client_has_a_company(db_session, user_id):
    """Premissa da leitura: `GET /clients/` sai de `companies`, então um
    cliente sem empresa sumiria da listagem sem erro nenhum. Este teste é o
    alarme dessa deriva — cliente criado por qualquer caminho que não passe
    pelos listeners aparece aqui."""
    from src.modules.clients.models import Client
    from src.modules.companies.models import Company

    _client(db_session, user_id)
    _prospect(db_session, user_id, name="Lead Aberto")

    sem_empresa = (
        db_session.query(Client)
        .filter(Client.is_active)
        .outerjoin(Company, Client.id == Company.id)
        .filter(Company.id.is_(None))
        .count()
    )

    assert sem_empresa == 0
