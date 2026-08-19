"""
Testes: revogar acesso de um membro da equipe a uma rotina.

Cenários:
1. Membro com rotina liberada no convite → owner revoga → membro perde o acesso.
2. Revogar de novo (sem acesso) → 400.
3. Não-owner não pode revogar → 403.
4. Rotina inexistente → 400.
"""

from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.team.repository import TeamRepository


def get_auth_header(client, email, name="Membro"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    client.post("/auth/register", json=payload)
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

    return owner_auth, member_auth, cli["id"], tmpl["id"], member_email


def test_revoke_routine_from_member(client):
    owner_auth, _member_auth, cli_id, tmpl_id, member_email = _setup(client)

    # Membro vê a rotina no time
    team = client.get(f"/clients/{cli_id}/team", headers=owner_auth).json()
    member = next(m for m in team["members"] if m["email"] == member_email)
    assert [r["template_id"] for r in member["routines"]] == [tmpl_id]

    # Revoga → 204 e membro perde a rotina
    res = client.delete(
        f"/clients/{cli_id}/team/{member['user_id']}/routines/{tmpl_id}",
        headers=owner_auth,
    )
    assert res.status_code == 204, res.text

    team = client.get(f"/clients/{cli_id}/team", headers=owner_auth).json()
    member = next(m for m in team["members"] if m["email"] == member_email)
    assert member["routines"] == []

    # Revogar de novo → 400 (sem acesso)
    res2 = client.delete(
        f"/clients/{cli_id}/team/{member['user_id']}/routines/{tmpl_id}",
        headers=owner_auth,
    )
    assert res2.status_code == 400, res2.text


def test_revoke_routine_denied_for_non_owner(client):
    owner_auth, member_auth, cli_id, tmpl_id, member_email = _setup(client)

    team = client.get(f"/clients/{cli_id}/team", headers=owner_auth).json()
    member = next(m for m in team["members"] if m["email"] == member_email)

    # Membro (não-owner) não pode revogar
    res = client.delete(
        f"/clients/{cli_id}/team/{member['user_id']}/routines/{tmpl_id}",
        headers=member_auth,
    )
    assert res.status_code == 403, res.text


def test_revoke_routine_unknown_template(client):
    owner_auth, _member_auth, cli_id, _tmpl_id, member_email = _setup(client)

    team = client.get(f"/clients/{cli_id}/team", headers=owner_auth).json()
    member = next(m for m in team["members"] if m["email"] == member_email)

    res = client.delete(
        f"/clients/{cli_id}/team/{member['user_id']}/routines/{uuid4()}",
        headers=owner_auth,
    )
    assert res.status_code == 400, res.text
