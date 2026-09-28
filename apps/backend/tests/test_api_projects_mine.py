"""Gestão › Projetos — "meus projetos" (dono ou membro convidado).

O fórum mostra o mural público; a gestão precisa da lista do próprio BPO:
os projetos que ele criou e os que ele aceitou participar. Sem isso, o filtro
"meus projetos" do fórum (feito no cliente sobre os 20 mais novos) esconde
projetos antigos do próprio dono.
"""

from uuid import uuid4

from tests.helpers import register_user


def auth_for(client, email):
    payload = {
        "email": email,
        "password": "StrongPassword123!",
        "name": "Projetos User",
    }
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return {"Authorization": f"Bearer {token}", "uid": me["id"], "email": me["email"]}


def create_project(client, auth, title="Projeto de teste", skills=None):
    resp = client.post(
        "/network/projects",
        json={
            "title": title,
            "description": "Projeto de automação do fluxo fiscal com revisão mensal.",
            "skills": skills if skills is not None else ["Python"],
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def accept_invite(client, owner, candidate, message="Quero você no time"):
    project = create_project(client, owner)
    invite = client.post(
        f"/network/projects/{project['id']}/invites",
        json={"invited_user_id": candidate["uid"], "message": message},
        headers=owner,
    )
    assert invite.status_code == 201, invite.text
    accept = client.post(
        f"/network/invites/{invite.json()['id']}/accept", headers=candidate
    )
    assert accept.status_code == 200, accept.text
    return project, accept.json()


# ── A lista ─────────────────────────────────────────────


def test_list_my_projects_returns_projects_i_own(client):
    auth = auth_for(client, f"dono_{uuid4()}@cafe.com")
    created = create_project(client, auth, title="Reconciliação bancária")

    resp = client.get("/network/projects/mine", headers=auth)

    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert [p["id"] for p in items] == [created["id"]]
    assert items[0]["is_owner"] is True
    assert items[0]["title"] == "Reconciliação bancária"


def test_list_my_projects_includes_project_i_was_invited_to(client):
    owner = auth_for(client, f"dono_{uuid4()}@cafe.com")
    partner = auth_for(client, f"parceiro_{uuid4()}@cafe.com")
    project, _ = accept_invite(client, owner, partner)

    resp = client.get("/network/projects/mine", headers=partner)

    assert resp.status_code == 200, resp.text
    items = resp.json()
    assert [p["id"] for p in items] == [project["id"]]
    assert items[0]["is_owner"] is False
    assert items[0]["is_group_member"] is True
    assert items[0]["group_id"]


def test_list_my_projects_excludes_pending_invitation(client):
    """Convidado que ainda não aceitou não participa do projeto."""
    owner = auth_for(client, f"dono_{uuid4()}@cafe.com")
    partner = auth_for(client, f"parceiro_{uuid4()}@cafe.com")
    project = create_project(client, owner)
    client.post(
        f"/network/projects/{project['id']}/invites",
        json={"invited_user_id": partner["uid"], "message": "Vem comigo"},
        headers=owner,
    )

    resp = client.get("/network/projects/mine", headers=partner)

    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_list_my_projects_excludes_declined_invitation(client):
    owner = auth_for(client, f"dono_{uuid4()}@cafe.com")
    partner = auth_for(client, f"parceiro_{uuid4()}@cafe.com")
    project = create_project(client, owner)
    invite = client.post(
        f"/network/projects/{project['id']}/invites",
        json={"invited_user_id": partner["uid"], "message": "Vem comigo"},
        headers=owner,
    ).json()
    client.post(f"/network/invites/{invite['id']}/decline", headers=partner)

    resp = client.get("/network/projects/mine", headers=partner)

    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_list_my_projects_never_returns_projects_of_other_people(client):
    other = auth_for(client, f"outro_{uuid4()}@cafe.com")
    create_project(client, other, title="Projeto privado alheio")

    auth = auth_for(client, f"eu_{uuid4()}@cafe.com")
    resp = client.get("/network/projects/mine", headers=auth)

    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_list_my_projects_excludes_archived_project(client):
    """Arquivar esconde da gestão (soft delete) — o mesmo comportamento do mural."""
    auth = auth_for(client, f"dono_{uuid4()}@cafe.com")
    created = create_project(client, auth)
    client.delete(f"/network/projects/{created['id']}", headers=auth)

    resp = client.get("/network/projects/mine", headers=auth)

    assert resp.status_code == 200, resp.text
    assert resp.json() == []


# ── Filtro por busca ─────────────────────────────────────


def test_list_my_projects_filters_by_title(client):
    auth = auth_for(client, f"dono_{uuid4()}@cafe.com")
    create_project(client, auth, title="Reconciliação bancária")
    create_project(client, auth, title="Implantação de ERP")

    resp = client.get("/network/projects/mine", params={"q": "recon"}, headers=auth)

    assert resp.status_code == 200, resp.text
    assert [p["title"] for p in resp.json()] == ["Reconciliação bancária"]


def test_list_my_projects_search_escapes_wildcards(client):
    auth = auth_for(client, f"dono_{uuid4()}@cafe.com")
    create_project(client, auth, title="Relatório 100% mensal")
    create_project(client, auth, title="Relatório 123 mensal")

    resp = client.get("/network/projects/mine", params={"q": "100%"}, headers=auth)

    assert resp.status_code == 200, resp.text
    assert [p["title"] for p in resp.json()] == ["Relatório 100% mensal"]


def test_list_my_projects_search_matches_description(client):
    auth = auth_for(client, f"dono_{uuid4()}@cafe.com")
    resp = client.post(
        "/network/projects",
        json={
            "title": "Projeto genérico",
            "description": "Foco total em conciliação de cartão de crédito.",
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text

    found = client.get(
        "/network/projects/mine", params={"q": "cartão de crédito"}, headers=auth
    )

    assert [p["title"] for p in found.json()] == ["Projeto genérico"]


# ── Sinalização e permissão ──────────────────────────────


def test_list_my_projects_counts_pending_proposals(client):
    owner = auth_for(client, f"dono_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"candidato_{uuid4()}@cafe.com")
    project = create_project(client, owner)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Tenho experiência com esse tipo de projeto."},
        headers=candidate,
    )

    resp = client.get("/network/projects/mine", headers=owner)

    assert resp.json()[0]["application_count"] == 1


def test_list_my_projects_requires_authentication(client):
    resp = client.get("/network/projects/mine")
    assert resp.status_code == 401


def test_list_my_projects_does_not_shadow_project_detail(client):
    """/projects/mine não pode ser interpretado como id de projeto."""
    auth = auth_for(client, f"dono_{uuid4()}@cafe.com")
    created = create_project(client, auth)

    resp = client.get(f"/network/projects/{created['id']}", headers=auth)

    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] == created["id"]
