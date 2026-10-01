"""Dashboard payload contract: a field exists only if a page renders it.

Phase 5 of the read-to-render plan. `/dashboard/summary` is the panel landing
page, read entirely by `pages/panel/DashboardPage.tsx` plus
`PendingInvitationCard`. Each assertion pins the exact key set of the payload it
builds, so a field cannot creep back in without a screen to render it.

This file also protects two things the dashboard had none of:

- `stats` was a bare `dict` on the schema; it is now a typed DTO, and no test
  asserted anything under it.
- `unread_notifications_count` was computed as `len(activities)`, the row list
  already capped at 20 — so a member with 25 unread notifications was told they
  had 20. The counter must be the real total.
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import status

from src.modules.auth.models import User
from src.modules.notifications.models import AppNotification
from tests.helpers import create_test_user

PASSWORD = "StrongPassword123!"

SUMMARY_KEYS = {
    "user_name",
    "urgent_tasks",
    "activities",
    "pending_invitations",
    "stats",
}

URGENT_TASK_KEYS = {
    "id",
    "title",
    "client_name",
    "deadline",
    "days_remaining",
    "is_overdue",
}

ACTIVITY_KEYS = {
    "id",
    "type",
    "created_at",
    "is_read",
    "post_id",
    "triggered_by_name",
    "message_snippet",
}

INVITATION_KEYS = {"invitation_id", "client_name", "inviter_name", "created_at"}

STATS_KEYS = {"pending_tasks_count", "unread_notifications_count"}


def _register(client, email: str, name: str = "Dash User") -> dict:
    """Registers a user and returns its authorization header.

    Args:
        client: The FastAPI test client.
        email: Email to register and log in with.
        name: Name of the user.

    Returns:
        The Authorization header of the new user.
    """
    create_test_user(email=email.lower(), password=PASSWORD, name=name)
    response = client.post(
        "/auth/login", data={"username": email.lower(), "password": PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _user_id(db_session, email: str):
    """Returns the id of a registered user.

    `register_user` hands back an instance from a closed session, so the id is
    read back here.

    Args:
        db_session: The test database session.
        email: Email of the user.

    Returns:
        The id of the user.
    """
    return db_session.query(User).filter(User.email == email.lower()).one().id


def test_the_summary_ships_the_five_keys_the_page_reads(client):
    """GET /dashboard/summary returns the top level the landing page consumes."""
    auth = _register(client, f"dash_sum_{uuid4()}@cafe.com")

    response = client.get("/dashboard/summary", headers=auth)

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()) == SUMMARY_KEYS


def test_an_urgent_task_drops_the_fields_the_carousel_never_reads(client):
    """The urgent task row carries only what the carousel and handler use.

    `priority` and `phase_id` are out: the dashboard highlights a task by its
    deadline alone, and completing one sends the phase resolved from `usePhases()`
    rather than the one the payload carries.
    """
    auth = _register(client, f"dash_task_{uuid4()}@cafe.com")
    company = client.post(
        "/clients/", json={"name": f"Empresa {uuid4()}"}, headers=auth
    ).json()
    deadline = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    created = client.post(
        "/tasks/",
        json={
            "title": "Fechar planilha",
            "client_id": company["id"],
            "deadline": deadline,
        },
        headers=auth,
    )
    assert created.status_code == status.HTTP_201_CREATED, created.text

    body = client.get("/dashboard/summary", headers=auth).json()

    assert body["urgent_tasks"], body["urgent_tasks"]
    assert set(body["urgent_tasks"][0]) == URGENT_TASK_KEYS


def test_an_activity_row_ships_only_what_the_feed_renders(client, db_session):
    """An activity row carries the post it links to, without the dead comment id."""
    email = f"dash_row_{uuid4()}@cafe.com"
    auth = _register(client, email)
    user_id = _user_id(db_session, email)
    db_session.add(
        AppNotification(
            user_id=user_id,
            title="Comentário",
            message="Mensagem",
            type="post_commented",
            related_entity_type="discussion_post",
        )
    )
    db_session.commit()

    body = client.get("/dashboard/summary", headers=auth).json()

    assert set(body["activities"][0]) == ACTIVITY_KEYS


def test_the_stats_block_is_typed_and_exact(client):
    """`stats` is a DTO now, with the two counters the sidebar renders."""
    auth = _register(client, f"dash_stats_{uuid4()}@cafe.com")

    body = client.get("/dashboard/summary", headers=auth).json()

    assert set(body["stats"]) == STATS_KEYS


def test_the_unread_counter_counts_every_row_not_the_capped_list(client, db_session):
    """The unread counter is the real total, not the length of the 20-row list."""
    email = f"dash_unread_{uuid4()}@cafe.com"
    auth = _register(client, email)
    user_id = _user_id(db_session, email)
    for index in range(25):
        db_session.add(
            AppNotification(
                user_id=user_id,
                title=f"Atividade {index}",
                message="Mensagem de teste",
                type="post_commented",
            )
        )
    db_session.commit()

    body = client.get("/dashboard/summary", headers=auth).json()

    # The activity feed is deliberately capped…
    assert len(body["activities"]) == 20
    # …but the counter the sidebar shows must not inherit that cap.
    assert body["stats"]["unread_notifications_count"] == 25


def test_a_pending_invitation_ships_only_what_the_card_renders(client):
    """The invitation card draws the inviter, the client and the age."""
    suffix = uuid4().hex[:8]
    member_email = f"dash_member_{suffix}@cafe.com"
    owner_auth = _register(client, f"dash_owner_{suffix}@cafe.com", name="Owner Silva")
    member_auth = _register(client, member_email, name="Membro Souza")
    company = client.post(
        "/clients/", json={"name": f"Cliente {suffix}"}, headers=owner_auth
    ).json()
    invited = client.post(
        f"/clients/{company['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert invited.status_code == status.HTTP_201_CREATED, invited.text

    body = client.get("/dashboard/summary", headers=member_auth).json()

    assert len(body["pending_invitations"]) == 1, body["pending_invitations"]
    assert set(body["pending_invitations"][0]) == INVITATION_KEYS


def test_the_invitation_card_takes_the_company_name_not_the_legacy_row(client):
    """O nome do convite vem de `companies` (Fase 3, item 5).

    O join pendurava em `teams.client_id → clients`. Aqui a empresa recebe um
    nome novo **sem** passar pela API — o espelho de cadastrais escreveria
    também na linha legada, e o teste deixaria de provar nada. O cartão precisa
    mostrar o nome da empresa: com o join antigo ele mostraria o da linha
    `clients`, que continua com o texto antigo.
    """
    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    suffix = uuid4().hex[:8]
    member_email = f"dash_fonte_{suffix}@cafe.com"
    owner_auth = _register(client, f"dash_fonte_owner_{suffix}@cafe.com", name="Owner")
    member_auth = _register(client, member_email, name="Membro")
    company = client.post(
        "/clients/", json={"name": f"Nome Antigo {suffix}"}, headers=owner_auth
    ).json()
    assert (
        client.post(
            f"/clients/{company['id']}/invite",
            json={"emails": [member_email], "template_ids": []},
            headers=owner_auth,
        ).status_code
        == status.HTTP_201_CREATED
    )

    session = SessionLocal()
    try:
        company_row = session.get(Company, UUID(company["id"]))
        company_row.name = f"Nome Novo {suffix}"
        session.commit()
    finally:
        session.close()

    body = client.get("/dashboard/summary", headers=member_auth).json()

    assert len(body["pending_invitations"]) == 1, body["pending_invitations"]
    assert body["pending_invitations"][0]["client_name"] == f"Nome Novo {suffix}"


def test_the_urgent_card_names_the_company_not_the_legacy_row(client):
    """O carrossel de urgentes tira o nome da empresa (Fase 3, item 7).

    Era o último join do módulo pendurado em `tasks.client_id → clients`. O
    teste dá à empresa um nome novo por fora da API — o espelho de cadastrais
    reescreveria a linha legada junto, e a asserção não provaria nada. Com o
    join antigo o cartão mostraria o nome velho da linha `clients`.
    """
    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    suffix = uuid4().hex[:8]
    auth = _register(client, f"dash_urgente_{suffix}@cafe.com")
    company = client.post(
        "/clients/", json={"name": f"Urgente Antigo {suffix}"}, headers=auth
    ).json()
    created = client.post(
        "/tasks/",
        json={
            "title": "Fechar planilha",
            "client_id": company["id"],
            "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
        headers=auth,
    )
    assert created.status_code == status.HTTP_201_CREATED, created.text

    session = SessionLocal()
    try:
        company_row = session.get(Company, UUID(company["id"]))
        company_row.name = f"Urgente Novo {suffix}"
        session.commit()
    finally:
        session.close()

    body = client.get("/dashboard/summary", headers=auth).json()

    assert body["urgent_tasks"], body["urgent_tasks"]
    assert body["urgent_tasks"][0]["client_name"] == f"Urgente Novo {suffix}", (
        "o cartão de urgente ainda lê o nome da linha legada `clients`"
    )


def test_an_urgent_task_survives_the_legacy_row_being_deactivated(client):
    """O carrossel não filtra a linha legada — e não deve passar a filtrar.

    Este teste **não** falha no código de hoje: o `INNER JOIN` casa por id e
    ignora `is_active`, então degradar a linha não tira a tarefa do painel. É
    uma trava de comportamento, não uma prova da correção: a migração do join
    pode ser feita com `Company.is_active` no filtro sem nenhum teste reclamar,
    e com a cascata de desativação (§16) isso apagaria do painel o que está
    vencendo. Preservar o comportamento é a decisão consciente deste item; se o
    dono quiser o contrário, é pendência 4.1 com regra nova.
    """
    from src.core.database import SessionLocal
    from src.modules.clients.models import Client

    suffix = uuid4().hex[:8]
    auth = _register(client, f"dash_degradado_{suffix}@cafe.com")
    company = client.post(
        "/clients/", json={"name": f"Urgente Degradada {suffix}"}, headers=auth
    ).json()
    created = client.post(
        "/tasks/",
        json={
            "title": "Fechar planilha",
            "client_id": company["id"],
            "deadline": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        },
        headers=auth,
    )
    assert created.status_code == status.HTTP_201_CREATED, created.text

    session = SessionLocal()
    try:
        session.query(Client).filter(Client.id == UUID(company["id"])).update(
            {"is_active": False}
        )
        session.commit()
    finally:
        session.close()

    body = client.get("/dashboard/summary", headers=auth).json()

    assert body["urgent_tasks"], (
        "a tarefa urgente sumiu do painel quando a linha legada foi degradada"
    )
