"""
Testes: cancelar (remover) um convite enviado.

Cenários:
1. Gestor cancela um convite pendente → 204 e o convite some da listagem.
2. Membro (não gestor) não pode cancelar → 403.
3. Cancelar convite de outro cliente → 400.
"""

from uuid import uuid4

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


def _setup(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text
    invitation_id = inv.json()["results"][0]["invitation_id"]

    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    return owner_auth, member_auth, cli["id"], invitation_id


def test_cancel_invitation(client):
    owner_auth, _member_auth, cli_id, invitation_id = _setup(client)

    # Convite aparece pendente
    invs = client.get(f"/clients/{cli_id}/invitations", headers=owner_auth).json()[
        "invitations"
    ]
    assert any(i["invitation_id"] == invitation_id for i in invs)

    # Cancela → 204
    res = client.delete(
        f"/clients/{cli_id}/invitations/{invitation_id}", headers=owner_auth
    )
    assert res.status_code == 204, res.text

    # Some da listagem
    invs = client.get(f"/clients/{cli_id}/invitations", headers=owner_auth).json()[
        "invitations"
    ]
    assert all(i["invitation_id"] != invitation_id for i in invs)


def test_cancel_invitation_denied_for_non_owner(client):
    owner_auth, member_auth, cli_id, invitation_id = _setup(client)

    res = client.delete(
        f"/clients/{cli_id}/invitations/{invitation_id}", headers=member_auth
    )
    assert res.status_code == 403, res.text

    # Convite continua lá
    invs = client.get(f"/clients/{cli_id}/invitations", headers=owner_auth).json()[
        "invitations"
    ]
    assert any(i["invitation_id"] == invitation_id for i in invs)


def test_cancel_invitation_unknown_invitation(client):
    owner_auth, _member_auth, cli_id, _invitation_id = _setup(client)

    res = client.delete(f"/clients/{cli_id}/invitations/{uuid4()}", headers=owner_auth)
    assert res.status_code == 400, res.text
