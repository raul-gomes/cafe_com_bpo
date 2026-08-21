"""
Testes: membro de equipe vê apenas as tasks do board, sem informações do cliente.

Cenários:
1. /clients/ não retorna o cliente onde o usuário é membro (só os próprios).
2. /tasks/ ainda agrega as tasks das rotinas concedidas ao membro.
3. Reativação de ex-membro não duplica: o convite é marcado como aceito
   e o membro aparece uma única vez na listagem.
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


def create_activity(client, auth, template_id, name):
    resp = client.post(
        f"/tasks/templates/{template_id}/activities",
        json={
            "name": name,
            "description": f"Descrição {name}",
            "estimated_minutes": 30,
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
    cli = create_client(client, owner_auth, name=f"Cliente Sigiloso {suf}")
    tmpl = create_template(client, owner_auth, f"Rotina {suf}")
    create_activity(client, owner_auth, tmpl["id"], f"Atividade {suf}")

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

    return owner_auth, member_auth, cli["id"], tmpl["id"], member_email


def test_member_does_not_see_shared_client(client):
    owner_auth, member_auth, cli_id, _tmpl_id, _member_email = _setup(client)

    # Owner vê o cliente normalmente
    owner_clients = client.get("/clients/", headers=owner_auth).json()
    assert any(c["id"] == cli_id for c in owner_clients)

    # Membro NÃO vê o cliente compartilhado em /clients/
    member_clients = client.get("/clients/", headers=member_auth).json()
    assert all(c["id"] != cli_id for c in member_clients)


def test_member_still_sees_board_tasks(client):
    owner_auth, member_auth, cli_id, tmpl_id, _member_email = _setup(client)

    # Owner vincula a rotina ao cliente → tasks são geradas
    resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli_id, "template_id": tmpl_id},
        headers=owner_auth,
    )
    assert resp.status_code == 201, resp.text

    tasks = client.get("/tasks/", headers=member_auth).json()
    assert isinstance(tasks, list)
    assert len(tasks) >= 1


def test_reactivated_member_not_duplicated(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    cli = create_client(client, owner_auth, name=f"Cliente Sigiloso {suf}")
    tmpl = create_template(client, owner_auth, f"Rotina {suf}")
    create_activity(client, owner_auth, tmpl["id"], f"Atividade {suf}")

    member_auth = get_auth_header(client, member_email, name="Membro Souza")

    def _invite_and_accept():
        inv = client.post(
            f"/clients/{cli['id']}/invite",
            json={"emails": [member_email], "template_ids": [tmpl["id"]]},
            headers=owner_auth,
        )
        assert inv.status_code == 201, inv.text
        invitation_id = inv.json()["results"][0]["invitation_id"]
        acc = client.post(f"/invitations/{invitation_id}/accept", headers=member_auth)
        assert acc.status_code == 200, acc.text
        assert acc.json()["status"] == "accepted"

    # 1º convite + aceite
    _invite_and_accept()

    # Owner remove o membro
    team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth).json()
    member = next(m for m in team["members"] if m["email"] == member_email)
    rem = client.delete(
        f"/clients/{cli['id']}/team/{member['user_id']}", headers=owner_auth
    )
    assert rem.status_code == 204, rem.text

    # 2º convite + aceite (reativação do ex-membro)
    _invite_and_accept()

    # Após reativar, não deve restar convite pendente para este email
    invitations = client.get(
        f"/clients/{cli['id']}/invitations", headers=owner_auth
    ).json()["invitations"]
    pending = [
        i
        for i in invitations
        if i["email"] == member_email and i["status"] != "accepted"
    ]
    assert pending == []

    # E o membro aparece uma única vez
    team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth).json()
    members = [m for m in team["members"] if m["email"] == member_email]
    assert len(members) == 1


def test_second_accept_does_not_duplicate_active_member(client):
    owner_auth, member_auth, cli_id, tmpl_id, member_email = _setup(client)

    # Já é membro ativo; um convite antigo (pendente) é aceito de novo
    raw = get_raw_token_for_invite(cli_id, member_email, [tmpl_id])
    acc = client.get(f"/invitations/accept?token={raw}", headers=member_auth)
    assert acc.status_code == 200, acc.text

    team = client.get(f"/clients/{cli_id}/team", headers=owner_auth).json()
    members = [m for m in team["members"] if m["email"] == member_email]
    assert len(members) == 1
