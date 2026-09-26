"""Testes de isolamento de tenant do filtro de eventos SSE.

Garante que `event_relevant_for_user` só libera eventos de clients que o
usuário é dono, membro ativo ou convidado envolvido. Sem esse filtro, o
BroadcastManager entregaria dados cross-tenant a qualquer cliente conectado
em /tasks/events (SSE-1).
"""

from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.auth.repository import UserRepository
from src.modules.auth.schemas import UserResponse
from src.modules.task_manager.task.service import event_relevant_for_user
from src.modules.team.repository import TeamRepository
from tests.helpers import create_test_user


def _login(client, email):
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _user_response(user_id: UUID) -> UserResponse:
    session = SessionLocal()
    try:
        user = UserRepository(session).get_user_by_id(user_id)
        return UserResponse.from_user(user)
    finally:
        session.close()


def _user_id_by_email(email: str) -> UUID:
    session = SessionLocal()
    try:
        return UserRepository(session).get_user_by_email(email).id
    finally:
        session.close()


def _is_relevant(current_user: UserResponse, channel: str, data) -> bool:
    session = SessionLocal()
    try:
        return event_relevant_for_user(session, current_user, channel, data)
    finally:
        session.close()


def _setup(client):
    """Owner cria client + rotina; membro é convidado e aceita; estranho fica fora."""
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"
    stranger_email = f"stranger_{suf}@cafe.com"

    create_test_user(owner_email)
    create_test_user(member_email)
    create_test_user(stranger_email)
    owner_id = _user_id_by_email(owner_email)
    member_id = _user_id_by_email(member_email)
    stranger_id = _user_id_by_email(stranger_email)

    owner_auth = _login(client, owner_email)

    c = client.post(
        "/clients/",
        json={"name": f"Empresa {suf}", "cnpj": "12.345.678/0001-99"},
        headers=owner_auth,
    )
    assert c.status_code == 201, c.text
    client_id = c.json()["id"]

    t = client.post(
        "/tasks/templates/",
        json={
            "name": f"Rotina {suf}",
            "process_type": "fiscal",
            "recurrence": "weekly",
            "weekday_mask": "1,4",
        },
        headers=owner_auth,
    )
    assert t.status_code == 201, t.text
    template_id = t.json()["id"]

    session = SessionLocal()
    try:
        team_repo = TeamRepository(session)
        team = team_repo.get_team_by_client_id(UUID(client_id))
        team_id = team.id
        invitation, _ = team_repo.create_invitation(
            team_id=team_id,
            invited_by=owner_id,
            invited_email=member_email,
            template_ids=[UUID(template_id)],
        )
        team_repo.accept_invitation_for_user(invitation, member_id)
        invitation_id = invitation.id
    finally:
        session.close()

    return {
        "client_id": UUID(client_id),
        "template_id": UUID(template_id),
        "invitation_id": invitation_id,
        "team_id": team_id,
        "owner_resp": _user_response(owner_id),
        "member_resp": _user_response(member_id),
        "stranger_resp": _user_response(stranger_id),
        "member_email": member_email,
    }


def test_task_updates_somente_owner_e_membro_com_rotina(client):
    ctx = _setup(client)
    grant = {
        "client_id": str(ctx["client_id"]),
        "template_id": str(ctx["template_id"]),
    }

    assert _is_relevant(ctx["owner_resp"], "task_updates", grant) is True
    assert _is_relevant(ctx["member_resp"], "task_updates", grant) is True
    assert _is_relevant(ctx["stranger_resp"], "task_updates", grant) is False

    # Membro SEM rotina concedida (task custom/raw) não recebe evento alheio
    custom_task = {"client_id": str(ctx["client_id"]), "template_id": None}
    assert _is_relevant(ctx["member_resp"], "task_updates", custom_task) is False
    assert _is_relevant(ctx["owner_resp"], "task_updates", custom_task) is True


def test_team_updates_member_changed(client):
    ctx = _setup(client)
    event = {
        "type": "member_changed",
        "team_id": str(ctx["team_id"]),
        "user_id": str(ctx["member_resp"].id),
        "is_active": True,
        "action": "INSERT",
    }

    assert _is_relevant(ctx["owner_resp"], "team_updates", event) is True
    # O próprio membro acompanha mudança da própria conta
    assert _is_relevant(ctx["member_resp"], "team_updates", event) is True
    assert _is_relevant(ctx["stranger_resp"], "team_updates", event) is False


def test_team_updates_invitation_changed(client):
    ctx = _setup(client)
    event = {
        "type": "invitation_changed",
        "team_id": str(ctx["team_id"]),
        "invited_email": ctx["member_email"],
        "status": "pending",
        "action": "INSERT",
    }

    assert _is_relevant(ctx["owner_resp"], "team_updates", event) is True
    # O convidado vê a própria mudança de convite (ainda não é membro aceito)
    assert _is_relevant(ctx["member_resp"], "team_updates", event) is True
    assert _is_relevant(ctx["stranger_resp"], "team_updates", event) is False


def test_team_updates_routine_changed(client):
    ctx = _setup(client)
    event = {
        "type": "routine_changed",
        "invitation_id": str(ctx["invitation_id"]),
        "template_id": str(ctx["template_id"]),
        "action": "DELETE",
    }

    assert _is_relevant(ctx["owner_resp"], "team_updates", event) is True
    # Membro do time precisa atualizar o board quando rotina é concedida/revogada
    assert _is_relevant(ctx["member_resp"], "team_updates", event) is True
    assert _is_relevant(ctx["stranger_resp"], "team_updates", event) is False


def test_eventos_com_dados_invalidos_ou_desconhecidos_sao_descartados(client):
    ctx = _setup(client)
    assert _is_relevant(ctx["owner_resp"], "task_updates", None) is False
    assert _is_relevant(ctx["owner_resp"], "task_updates", {}) is False
    assert _is_relevant(ctx["owner_resp"], "canal_inexistente", {}) is False

    team_event_sem_team = {"type": "member_changed", "invited_email": "x@y.com"}
    assert _is_relevant(ctx["owner_resp"], "team_updates", team_event_sem_team) is False
