"""Regra §16 — desativar uma empresa cascateia `is_active = false` em tudo.

O dono do produto definiu (2026-09-30) que **não existe hard delete**: arquivar
uma empresa marca `is_active = false` nela e em toda linha que aponta para ela
por `company_id`, preservando o histórico (quando esteve ativa, quais tarefas,
orçamentos e contratos existiam).

O que estes testes travam:

- a cascata cobre **toda** tabela com `company_id` (tarefas, times, SLAs,
  rotinas, orçamentos, contratos) — o cascade anterior cobria só tarefas e
  orçamentos, e só por `client_id`, então time/SLA/rotina/contrato continuavam
  ativos para uma empresa arquivada;
- o **contato da empresa não entra** na cascata: continua ativo e a agenda
  mostra a pessoa de uma empresa arquivada (decisão do dono do produto em
  2026-09-30, regra §13 mantida ao lado da §16);
- a cascata é por **`company_id`**, então prospecto (não convertido) e cliente
  (convertido) têm o mesmo comportamento;
- **nada é apagado**: as linhas continuam no banco, com `is_active = false` e
  `deleted_at` preenchido (o instante da desativação).
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from src.modules.auth.repository import UserRepository
from src.modules.clients.models import Client
from src.modules.companies.deactivation import deactivate_company
from src.modules.companies.models import Company
from src.modules.contacts.models import Contact
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.task_manager.models import (
    ActivityTemplate,
    ClientSLA,
    ClientTemplateAssignment,
    Task,
)
from src.modules.team.models import Team
from tests.helpers import pricing_input_for_total


@pytest.fixture
def user_id(db_session) -> UUID:
    """A BPO user that owns every row of the test."""
    user = UserRepository(db_session).create_user(
        email=f"deactivate_{uuid4()}@cafe.com",
        password_hash="hash",
        auth_provider="local",
    )
    return user.id


def _company(db_session, user_id: UUID, *, as_client: bool) -> object:
    """Creates the legacy record (prospect or client); the mirror company follows."""
    record = (
        Client(user_id=user_id, name="Castellum")
        if as_client
        else Prospect(user_id=user_id, name="Lead Aberto")
    )
    db_session.add(record)
    db_session.commit()
    return record


def _full_tree(
    db_session, user_id: UUID, company_id: UUID, *, company_is_client: bool
) -> dict:
    """Creates one active row on every table that has `company_id`.

    A team, an SLA and a routine only accept a company of type `client`, so the
    client-only rows are created against a client company.
    """
    rows = {}
    # O time 1:1 já existe quando o cliente é criado pela API (`get_or_create_team`),
    # então o teste usa o time existente em vez de criar um segundo (client_id é
    # único). Num prospecto não há time — `teams` só aceita empresa do tipo client.
    if company_is_client:
        team = db_session.query(Team).filter(Team.company_id == company_id).first()
        if team is None:
            # Time criado direto no banco (o caminho da API usa
            # `TeamRepository.get_or_create_team`); `client_id` é único, então só
            # entra quando ainda não existe.
            team = Team(
                owner_id=user_id,
                client_id=company_id,
                company_id=company_id,
                company_type="client",
            )
            db_session.add(team)
            db_session.commit()
        rows["team"] = team
    rows["contact"] = Contact(
        user_id=user_id,
        company_id=company_id,
        nome="Marina Reis",
        cpf="12345678909",
    )
    rows["task"] = Task(
        user_id=user_id,
        client_id=company_id,
        company_id=company_id,
        company_type="client",
        title="Revisar contratos",
    )
    rows["sla"] = ClientSLA(
        user_id=user_id,
        client_id=company_id,
        company_id=company_id,
        company_type="client",
        process_type="abertura",
        sla_days=5,
        warning_threshold=0.8,
    )
    template = ActivityTemplate(user_id=user_id, name="Rotina diária")
    db_session.add(template)
    db_session.commit()
    rows["routine"] = ClientTemplateAssignment(
        user_id=user_id,
        client_id=company_id,
        company_id=company_id,
        company_type="client",
        template_id=template.id,
    )
    rows["scenario"] = PricingScenario(
        user_id=user_id,
        company_id=company_id,
        client_name="Castellum",
        input_payload=pricing_input_for_total(100.0),
        result_payload={"final_price": 100.0},
    )
    rows["contract"] = Contract(
        user_id=user_id,
        company_id=company_id,
        client_name="Castellum",
        sections=[],
    )
    for row in rows.values():
        db_session.add(row)
    db_session.commit()
    return rows


# --- a cascata ---------------------------------------------------------------


def test_deactivating_a_company_deactivates_every_child(db_session, user_id):
    """Rule §16: tasks, teams, SLAs, routines, proposals and contracts all go to
    `is_active = false` — none of them was left active."""
    client = _company(db_session, user_id, as_client=True)
    rows = _full_tree(db_session, user_id, client.id, company_is_client=True)

    report = deactivate_company(db_session, client.id)
    assert report, "the cascade deactivated nothing"

    db_session.expire_all()
    for name, row in rows.items():
        if name == "contact":
            continue  # §13: o contato não entra na cascata
        assert db_session.get(type(row), row.id).is_active is False, (
            f"{name} stayed active after the company was deactivated (report: {report})"
        )


def test_deactivating_a_company_keeps_every_row(db_session, user_id):
    """Rule §16: nothing is hard deleted — the rows stay, with `deleted_at`."""
    client = _company(db_session, user_id, as_client=True)
    rows = _full_tree(db_session, user_id, client.id, company_is_client=True)

    deactivate_company(db_session, client.id)

    db_session.expire_all()
    for name, row in rows.items():
        stored = db_session.get(type(row), row.id)
        assert stored is not None, f"{name} was deleted"
        if name == "contact":
            continue  # §13: o contato não entra na cascata
        assert stored.deleted_at is not None, f"{name} has no deactivation date"


def test_deactivating_a_prospect_company_works_the_same(db_session, user_id):
    """Rule §16: the cascade is keyed by `company_id`, so a prospect (no team,
    no SLA, no routine) loses its proposals and contracts too."""
    prospect = _company(db_session, user_id, as_client=False)
    scenario = PricingScenario(
        user_id=user_id,
        company_id=prospect.id,
        client_name="Lead Aberto",
        input_payload=pricing_input_for_total(100.0),
        result_payload={"final_price": 100.0},
    )
    contract = Contract(
        user_id=user_id,
        company_id=prospect.id,
        client_name="Lead Aberto",
        sections=[],
    )
    db_session.add_all([scenario, contract])
    db_session.commit()

    deactivate_company(db_session, prospect.id)

    db_session.expire_all()
    for row in (scenario, contract):
        assert db_session.get(type(row), row.id).is_active is False


def test_deactivating_one_company_leaves_the_other_alone(db_session, user_id):
    """Rule §16: the cascade is scoped to the company being deactivated."""
    first = _company(db_session, user_id, as_client=True)
    second = _company(db_session, user_id, as_client=True)
    first_rows = _full_tree(db_session, user_id, first.id, company_is_client=True)
    second_rows = _full_tree(db_session, user_id, second.id, company_is_client=True)

    deactivate_company(db_session, first.id)

    db_session.expire_all()
    assert all(
        db_session.get(type(row), row.id).is_active for row in second_rows.values()
    ), "deactivating one company reached another"
    assert all(
        db_session.get(type(row), row.id).is_active is False
        for name, row in first_rows.items()
        if name != "contact"
    )


def test_deactivating_a_company_sets_the_same_instant_everywhere(db_session, user_id):
    """Rule §16: the deactivation is one event, so the date is the same row —
    that is what makes "what existed when the company was active" answerable."""
    client = _company(db_session, user_id, as_client=True)
    rows = _full_tree(db_session, user_id, client.id, company_is_client=True)

    before = datetime.now(timezone.utc).replace(tzinfo=None)
    deactivate_company(db_session, client.id)

    db_session.expire_all()
    stamps = {
        db_session.get(type(row), row.id).deleted_at
        for name, row in rows.items()
        if name != "contact"
    }
    assert len(stamps) == 1, f"different deactivation instants: {stamps}"
    stamp = stamps.pop()
    # SQLite devolve `DateTime(timezone=True)` sem tzinfo; o instante é o mesmo.
    assert stamp >= before, f"deactivation stamped before the call: {stamp} < {before}"


# --- a regra no banco ---------------------------------------------------------


def test_database_refuses_the_hard_delete_of_a_company(db_session, user_id):
    """Rule §16: the FK is NO ACTION, so deleting the company raises — the
    application has to deactivate, and nothing is silently erased.

    SQLite ignores foreign keys unless the PRAGMA is on (the test engine leaves
    it off), so the test turns it on to exercise the constraint the model
    declares; PostgreSQL is verified in the rehearsal (runbook §2.3).
    """
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    client = _company(db_session, user_id, as_client=True)
    task = Task(
        user_id=user_id,
        client_id=client.id,
        company_id=client.id,
        company_type="client",
        title="Revisar contratos",
    )
    db_session.add(task)
    db_session.commit()
    db_session.execute(text("PRAGMA foreign_keys = ON"))

    db_session.delete(db_session.get(Company, client.id))
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def _register_and_login(client) -> tuple[dict, UUID]:
    """Registers a BPO user through the API and returns (headers, user id)."""
    from tests.helpers import register_user

    email = f"archive_{uuid4()}@cafe.com"
    register_user(payload={"email": email, "password": "StrongPassword123!"})
    token = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/auth/me", headers=headers).json()
    return headers, UUID(me["id"])


def test_deactivating_a_company_keeps_its_contact_active(db_session, user_id):
    """Rule §13 + §16: the contact survives the archive of its company.

    The agenda must show the person of an archived company (rule §13), so the
    contact does not follow the cascade — it is the record of *who the person
    was*, and losing it from view would lose the history the rule exists for.
    """
    client = _company(db_session, user_id, as_client=True)
    rows = _full_tree(db_session, user_id, client.id, company_is_client=True)

    deactivate_company(db_session, client.id)

    db_session.expire_all()
    stored = db_session.get(Contact, rows["contact"].id)
    assert stored.is_active is True
    assert stored.nome == "Marina Reis"


# --- os endpoints de arquivamento chamam a cascata ----------------------------


def test_archiving_a_client_deactivates_the_whole_tree(client):
    """Rule §16: `DELETE /clients/{id}` desativa tudo que pertence à empresa.

    Antes, o archive de cliente cascateava só tarefas e orçamentos (por
    `client_id`): o contato, o time, o SLA, a rotina e o contrato continuavam
    ativos para uma empresa arquivada.
    """
    from src.core.database import SessionLocal

    headers, user_id = _register_and_login(client)
    created = client.post(
        "/clients/",
        json={"name": "Castellum Financial"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    client_id = UUID(created.json()["id"])

    session = SessionLocal()
    try:
        rows = _full_tree(session, user_id, client_id, company_is_client=True)
        row_ids = {name: (type(row), row.id) for name, row in rows.items()}
    finally:
        session.close()

    archived = client.delete(f"/clients/{client_id}", headers=headers)
    assert archived.status_code in (200, 204), archived.text

    session = SessionLocal()
    try:
        for name, (model, row_id) in row_ids.items():
            stored = session.get(model, row_id)
            expected_active = name == "contact"
            assert stored.is_active is expected_active, (
                f"{name}: is_active={stored.is_active}, expected {expected_active}"
            )
            if expected_active:
                continue
            assert stored.deleted_at is not None, f"{name} has no deactivation date"
    finally:
        session.close()


def test_archiving_a_prospect_deactivates_the_whole_tree(client):
    """Rule §16: `DELETE /prospects/{id}` desativa o que pertence à empresa do
    prospecto — o mesmo caminho do cliente, porque a cascata é por `company_id`."""
    from src.core.database import SessionLocal

    headers, user_id = _register_and_login(client)
    created = client.post(
        "/prospects/",
        json={"name": "Lead Aberto", "phone": "2132221111"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    prospect_id = UUID(created.json()["id"])

    session = SessionLocal()
    try:
        contact = Contact(
            user_id=user_id,
            company_id=prospect_id,
            nome="Nina Prospecto",
        )
        contract = Contract(
            user_id=user_id,
            company_id=prospect_id,
            client_name="Lead Aberto",
            sections=[],
        )
        session.add_all([contact, contract])
        session.commit()
        row_ids = {Contact: contact.id, Contract: contract.id}
    finally:
        session.close()

    archived = client.delete(f"/prospects/{prospect_id}", headers=headers)
    assert archived.status_code in (200, 204), archived.text

    session = SessionLocal()
    try:
        for model, row_id in row_ids.items():
            stored = session.get(model, row_id)
            if model is Contact:
                # §13: o contato continua ativo e visível na agenda.
                assert stored.is_active is True
                continue
            assert stored.is_active is False, f"{model.__name__} stayed active"
            assert stored.deleted_at is not None, f"{model.__name__} has no date"
    finally:
        session.close()


def test_archiving_a_client_deactivates_the_company_row(client):
    """Regra §16: arquivar o cliente desativa a **empresa** e some da listagem.

    A listagem de clientes é lida de `companies` (Fase 3, item 3), então a
    empresa é a linha que decide o que aparece. Sem desativá-la junto, o
    cliente arquivado continuava na tela — e `DELETE` devolvia 204 como se
    tivesse funcionado.
    """
    from src.core.database import SessionLocal

    headers, _ = _register_and_login(client)
    created = client.post(
        "/clients/", json={"name": "Castellum Arquivado"}, headers=headers
    )
    assert created.status_code == 201, created.text
    client_id = UUID(created.json()["id"])

    archived = client.delete(f"/clients/{client_id}", headers=headers)
    assert archived.status_code in (200, 204), archived.text

    session = SessionLocal()
    try:
        company = session.get(Company, client_id)
        assert company.is_active is False
        assert company.deleted_at is not None
    finally:
        session.close()

    listed = client.get("/clients/", headers=headers).json()
    assert listed == [], "cliente arquivado não pode continuar na listagem"


def test_archiving_a_prospect_deactivates_the_company_row(client):
    """Regra §16: arquivar o prospecto desativa a empresa e some da listagem.

    Mesma razão do cliente, agora pela leitura de prospects (Fase 3, item 4):
    quem filtra a tela é `companies.is_active`.
    """
    from src.core.database import SessionLocal

    headers, _ = _register_and_login(client)
    created = client.post(
        "/prospects/", json={"name": "Lead Arquivado"}, headers=headers
    )
    assert created.status_code == 201, created.text
    prospect_id = UUID(created.json()["id"])

    archived = client.delete(f"/prospects/{prospect_id}", headers=headers)
    assert archived.status_code in (200, 204), archived.text

    session = SessionLocal()
    try:
        company = session.get(Company, prospect_id)
        assert company.is_active is False
        assert company.deleted_at is not None
    finally:
        session.close()

    listed = client.get("/prospects/", headers=headers).json()
    assert listed == [], "prospecto arquivado não pode continuar na listagem"
