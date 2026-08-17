"""
Testes do ciclo de convites: listagem com status + reenvio.

Cenários:
1. Owner cria cliente e convida colaborador → convite aparece como 'pending'.
2. Owner lista convites (GET /clients/{id}/invitations) → email + status.
3. Owner reenvia convite (POST .../resend) → novo token, status 'pending',
   expiração renovada.
4. Colaborador aceita → convite passa a 'accepted' na listagem.
5. Não-owner não pode listar nem reenviar convites.
6. Reenviar convite já aceito → erro.
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


def get_raw_token_for_invite(client_id: str, invited_email: str):
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
            template_ids=[],
        )
        return raw
    finally:
        session.close()


def test_invitation_list_and_resend_flow(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    # 1) Owner convida colaborador (sem rotinas, foco no ciclo de convite)
    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text
    assert inv.json()["total_sent"] == 1

    # 2) Listar convites → pending com email e dados
    lst = client.get(f"/clients/{cli['id']}/invitations", headers=owner_auth)
    assert lst.status_code == 200, lst.text
    invites = lst.json()["invitations"]
    assert len(invites) == 1
    pend = invites[0]
    assert pend["email"] == member_email
    assert pend["status"] == "pending"
    assert pend["accepted_at"] is None
    assert "invitation_id" in pend

    # 3) Reenviar → token renovado, expiração futura, status 'pending'
    res = client.post(
        f"/clients/{cli['id']}/invitations/{pend['invitation_id']}/resend",
        headers=owner_auth,
    )
    assert res.status_code == 200, res.text
    renewed = res.json()
    assert renewed["status"] == "pending"
    assert renewed["email"] == member_email

    # Expiração deve ter sido renovada (nova data no futuro, > antes)
    from datetime import datetime

    old_exp = datetime.fromisoformat(pend["expires_at"])
    new_exp = datetime.fromisoformat(renewed["expires_at"])
    assert new_exp > old_exp

    # 4) Colaborador aceita → status vira 'accepted'
    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    raw = get_raw_token_for_invite(cli["id"], member_email)
    acc = client.get(f"/invitations/accept?token={raw}", headers=member_auth)
    assert acc.status_code == 200, acc.text
    assert acc.json()["status"] == "accepted"

    lst = client.get(f"/clients/{cli['id']}/invitations", headers=owner_auth)
    invites = lst.json()["invitations"]
    accepted = next(
        i for i in invites if i["email"] == member_email and i["status"] == "accepted"
    )
    assert accepted["accepted_at"] is not None

    # 5) Reenviar convite aceito → erro
    res = client.post(
        f"/clients/{cli['id']}/invitations/{accepted['invitation_id']}/resend",
        headers=owner_auth,
    )
    assert res.status_code == 400, res.text
    assert "aceito" in res.json()["detail"]


def test_invitation_list_denied_for_non_owner(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text

    # Membro (não aceitou) não pode listar convites
    lst = client.get(f"/clients/{cli['id']}/invitations", headers=member_auth)
    assert lst.status_code == 403, lst.text

    # Membro não pode reenviar convite
    pending = client.get(
        f"/clients/{cli['id']}/invitations", headers=owner_auth
    ).json()["invitations"][0]
    res = client.post(
        f"/clients/{cli['id']}/invitations/{pending['invitation_id']}/resend",
        headers=member_auth,
    )
    assert res.status_code == 403, res.text

    # Sem token → 401
    lst = client.get(f"/clients/{cli['id']}/invitations")
    assert lst.status_code == 401, lst.text


def test_invitation_list_includes_declined(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )

    # Marca o convite como declinado diretamente no banco
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(cli["id"]))
        inv = repo.get_pending_invitation_by_email(team.id, member_email)
        repo.decline_invitation(inv)
    finally:
        session.close()

    lst = client.get(f"/clients/{cli['id']}/invitations", headers=owner_auth)
    assert lst.status_code == 200
    invs = lst.json()["invitations"]
    assert invs[0]["email"] == member_email
    assert invs[0]["status"] == "declined"

    # Reenviar convite declinado → reabre como pending
    res = client.post(
        f"/clients/{cli['id']}/invitations/{invs[0]['invitation_id']}/resend",
        headers=owner_auth,
    )
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "pending"


def get_invitation_id(client, cli_id: str, member_email: str):
    """Retorna invitation_id do convite pendente de member_email."""
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(cli_id))
        inv = repo.get_pending_invitation_by_email(team.id, member_email)
        assert inv is not None, "Convite pendente não encontrado"
        return inv.id
    finally:
        session.close()


def test_dashboard_pending_invitation_and_accept_by_id(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    # Convite pendente para o membro
    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text
    assert inv.json()["total_sent"] == 1

    # 1) Dashboard do membro lista o convite pendente
    dash = client.get("/dashboard/summary", headers=member_auth)
    assert dash.status_code == 200, dash.text
    pending = dash.json()["pending_invitations"]
    assert len(pending) == 1
    assert pending[0]["client_name"] == f"Cliente {suf}"
    assert pending[0]["inviter_name"] == "Owner Silva"
    assert pending[0]["invitation_id"] == str(
        get_invitation_id(client, cli["id"], member_email)
    )

    # 2) Dashboard de quem não tem convite → vazio
    other_auth = get_auth_header(client, f"other_{suf}@cafe.com", name="Outro")
    dash_other = client.get("/dashboard/summary", headers=other_auth)
    assert dash_other.status_code == 200
    assert dash_other.json()["pending_invitations"] == []

    # 3) Aceitar pelo ID (na dashboard) → aceito
    inv_id = pending[0]["invitation_id"]
    acc = client.post(f"/invitations/{inv_id}/accept", headers=member_auth)
    assert acc.status_code == 200, acc.text
    assert acc.json()["status"] == "accepted"
    assert acc.json()["client_name"] == f"Cliente {suf}"

    # Não aparece mais como pendente na dashboard
    dash2 = client.get("/dashboard/summary", headers=member_auth)
    assert dash2.status_code == 200
    assert dash2.json()["pending_invitations"] == []

    # 4) Aceitar de novo → erro
    acc2 = client.post(f"/invitations/{inv_id}/accept", headers=member_auth)
    assert acc2.status_code == 400, acc2.text

    # 5) Outro usuário tentando aceitar → erro
    other_inv = get_auth_header(client, f"other2_{suf}@cafe.com", name="Outro2")
    cli2 = create_client(client, other_inv, name=f"Outro Cliente {suf}")
    inv2 = client.post(
        f"/clients/{cli2['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=other_inv,
    )
    assert inv2.status_code == 201, inv2.text
    inv2_id = get_invitation_id(client, cli2["id"], member_email)
    acc3 = client.post(f"/invitations/{inv2_id}/accept", headers=other_inv)
    assert acc3.status_code == 400, acc3.text
    assert "enviado para" in acc3.json()["detail"]


def test_decline_invitation_by_id(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text

    inv_id = get_invitation_id(client, cli["id"], member_email)

    # 1) Recusar pelo ID → status declined
    dec = client.post(f"/invitations/{inv_id}/decline", headers=member_auth)
    assert dec.status_code == 200, dec.text
    assert dec.json()["status"] == "declined"

    # Não aparece mais como pendente na dashboard
    dash = client.get("/dashboard/summary", headers=member_auth)
    assert dash.status_code == 200
    assert dash.json()["pending_invitations"] == []

    # 2) Recusar de novo → erro
    dec2 = client.post(f"/invitations/{inv_id}/decline", headers=member_auth)
    assert dec2.status_code == 400, dec2.text

    # 3) Outro usuário tentando recusar → erro
    stranger_auth = get_auth_header(client, f"stranger_{suf}@cafe.com", name="X")
    dec3 = client.post(f"/invitations/{inv_id}/decline", headers=stranger_auth)
    assert dec3.status_code == 400, dec3.text

    # 4) Sem token → 401
    dec4 = client.post(f"/invitations/{inv_id}/decline")
    assert dec4.status_code == 401, dec4.text
