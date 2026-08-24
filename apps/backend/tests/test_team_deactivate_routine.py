"""
Testes: desativar vínculo de rotina desativa o acesso para a equipe toda (regra §2).

Cenários:
1. Owner desativa o vínculo → colaborador perde o acesso à rotina.
2. Owner reativa o vínculo → colaborador volta a ter acesso.
3. Membro não vê mais as tasks da rotina desativada.
"""

from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.team.repository import TeamRepository
from tests.helpers import register_user


def get_auth_header(client, email, name="Membro"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth, name="Empresa Teste"):
    resp = client.post(
        "/clients/", json={"name": name, "cnpj": "12.345.678/0001-99"}, headers=auth
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_template(client, auth, name):
    resp = client.post(
        "/tasks/templates/",
        json={
            "name": name,
            "process_type": "fiscal",
            "recurrence": "weekly",
            "weekday_mask": "1,4",
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def get_raw_token_for_invite(client_id: str, invited_email: str, template_ids=None):
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(client_id))
        inv = repo.get_pending_invitation_by_email(team.id, invited_email)
        assert inv is not None, "Convite pendente não encontrado"
        _, raw = repo.create_invitation(
            team_id=team.id,
            invited_by=inv.invited_by,
            invited_email=invited_email,
            template_ids=[UUID(t) for t in (template_ids or [])],
        )
        return raw
    finally:
        session.close()


def _setup(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")
    tmpl = create_template(client, owner_auth, f"Rotina {suf}")

    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": [tmpl["id"]]},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text

    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    raw = get_raw_token_for_invite(cli["id"], member_email, [tmpl["id"]])
    acc = client.get(f"/invitations/accept?token={raw}", headers=member_auth)
    assert acc.status_code == 200, acc.text
    assert acc.json()["status"] == "accepted"

    assign = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl["id"]},
        headers=owner_auth,
    )
    assert assign.status_code == 201, assign.text

    return (
        owner_auth,
        member_auth,
        cli["id"],
        tmpl["id"],
        member_email,
        assign.json()["assignment_id"],
    )


def _member_routine_ids(client, owner_auth, cli_id, member_email) -> list[str]:
    team = client.get(f"/clients/{cli_id}/team", headers=owner_auth).json()
    member = next(m for m in team["members"] if m["email"] == member_email)
    return [r["template_id"] for r in member["routines"]]


def test_deactivate_assignment_hides_routine_from_member(client):
    owner_auth, _member_auth, cli_id, tmpl_id, member_email, assignment_id = _setup(
        client
    )

    # Membro enxerga a rotina antes da desativação
    assert _member_routine_ids(client, owner_auth, cli_id, member_email) == [tmpl_id]

    res = client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": False},
        headers=owner_auth,
    )
    assert res.status_code == 200, res.text
    assert res.json()["is_active"] is False

    # Rotina desativada some do acesso do membro (equipe toda)
    assert _member_routine_ids(client, owner_auth, cli_id, member_email) == []


def test_reactivate_assignment_restores_routine_for_member(client):
    owner_auth, _member_auth, cli_id, tmpl_id, member_email, assignment_id = _setup(
        client
    )

    client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": False},
        headers=owner_auth,
    )
    assert _member_routine_ids(client, owner_auth, cli_id, member_email) == []

    res = client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": True},
        headers=owner_auth,
    )
    assert res.status_code == 200, res.text

    assert _member_routine_ids(client, owner_auth, cli_id, member_email) == [tmpl_id]
