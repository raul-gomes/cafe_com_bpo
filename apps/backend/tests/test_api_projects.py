from uuid import uuid4

from tests.helpers import register_user


def get_auth_header(client, email):
    payload = {
        "email": email,
        "password": "StrongPassword123!",
        "name": "Projects User",
    }
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_project(client, headers, **overrides):
    payload = {
        "title": "Migração de plataforma contábil",
        "description": (
            "Projeto para migrar a contabilidade de 50 clientes para a nova "
            "plataforma, com treinamento da equipe e revisão dos lançamentos."
        ),
        "skills": ["Python", "Excel"],
        "team_size": 2,
        "remote_type": "remote",
    }
    payload.update(overrides)
    return client.post("/network/projects", json=payload, headers=headers)


def add_skills(client, headers, names):
    for name in names:
        client.post("/network/me/skills", json={"name": name}, headers=headers)


# ── CRUD ────────────────────────────────────────────────


def test_create_project_success_with_skills(client):
    auth = get_auth_header(client, f"proj_{uuid4()}@cafe.com")
    resp = create_project(client, auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Migração de plataforma contábil"
    assert data["status"] == "open"
    assert data["team_size"] == 2
    assert data["remote_type"] == "remote"
    assert data["published_at"] is not None
    assert data["owner"]["id"] == data["owner_id"]


def test_create_project_without_skills(client):
    auth = get_auth_header(client, f"noskill_{uuid4()}@cafe.com")
    resp = create_project(client, auth, skills=[])
    assert resp.status_code == 201
    assert resp.json()["skills"] == []


def test_get_project_detail_and_404(client):
    auth = get_auth_header(client, f"detail_{uuid4()}@cafe.com")
    created = create_project(client, auth)
    pid = created.json()["id"]

    detail = client.get(f"/network/projects/{pid}", headers=auth)
    assert detail.status_code == 200
    names = [s["name"] for s in detail.json()["skills"]]
    assert "Python" in names and "Excel" in names

    missing = client.get(f"/network/projects/{uuid4()}", headers=auth)
    assert missing.status_code == 404


def test_list_projects_with_created_by_any_user(client):
    auth1 = get_auth_header(client, f"list1_{uuid4()}@cafe.com")
    auth2 = get_auth_header(client, f"list2_{uuid4()}@cafe.com")
    create_project(client, auth1, title="Projeto Alfa")
    create_project(client, auth2, title="Projeto Beta", skills=["React"])

    resp = client.get("/network/projects?limit=20", headers=auth1)
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()["items"]]
    assert "Projeto Alfa" in titles and "Projeto Beta" in titles


def test_filter_projects_by_skill(client):
    auth = get_auth_header(client, f"fskill_{uuid4()}@cafe.com")
    create_project(client, auth, title="Com Python")
    create_project(client, auth, title="Com Excel", skills=["Excel"])
    create_project(client, auth, title="Ambos", skills=["Python", "Excel"])

    resp = client.get("/network/projects?skills=python", headers=auth)
    titles = [p["title"] for p in resp.json()["items"]]
    assert "Com Python" in titles and "Ambos" in titles
    assert "Com Excel" not in titles


def test_filter_projects_by_status_and_remote_type(client):
    auth = get_auth_header(client, f"fstatus_{uuid4()}@cafe.com")
    create_project(client, auth, title="Remoto")
    create_project(client, auth, title="Presencial", remote_type="onsite")

    by_remote = client.get("/network/projects?remote_type=remote", headers=auth)
    titles = [p["title"] for p in by_remote.json()["items"]]
    assert "Remoto" in titles and "Presencial" not in titles


# ── Update / Delete (só owner) ──────────────────────────


def test_update_project_only_owner(client):
    owner = get_auth_header(client, f"up_owner_{uuid4()}@cafe.com")
    other = get_auth_header(client, f"up_other_{uuid4()}@cafe.com")
    pid = create_project(client, owner).json()["id"]

    denied = client.patch(
        f"/network/projects/{pid}",
        json={"title": "Invadido"},
        headers=other,
    )
    assert denied.status_code == 403

    ok = client.patch(
        f"/network/projects/{pid}",
        json={"title": "Título atualizado", "team_size": 3},
        headers=owner,
    )
    assert ok.status_code == 200
    assert ok.json()["title"] == "Título atualizado"
    assert ok.json()["team_size"] == 3


def test_update_project_resync_skills(client):
    auth = get_auth_header(client, f"resync_{uuid4()}@cafe.com")
    pid = create_project(client, auth, skills=["Python"]).json()["id"]

    add = client.patch(
        f"/network/projects/{pid}", json={"skills": ["Python", "Excel"]}, headers=auth
    )
    assert add.status_code == 200
    assert sorted(s["name"] for s in add.json()["skills"]) == ["Excel", "Python"]

    remove = client.patch(
        f"/network/projects/{pid}", json={"skills": ["Excel"]}, headers=auth
    )
    assert remove.status_code == 200
    assert [s["name"] for s in remove.json()["skills"]] == ["Excel"]


def test_delete_project_only_owner(client):
    owner = get_auth_header(client, f"del_owner_{uuid4()}@cafe.com")
    other = get_auth_header(client, f"del_other_{uuid4()}@cafe.com")
    pid = create_project(client, owner).json()["id"]

    denied = client.delete(f"/network/projects/{pid}", headers=other)
    assert denied.status_code == 403

    ok = client.delete(f"/network/projects/{pid}", headers=owner)
    assert ok.status_code == 204

    detail = client.get(f"/network/projects/{pid}", headers=owner)
    assert detail.status_code == 404
    listing = client.get("/network/projects", headers=owner)
    assert all(p["id"] != pid for p in listing.json()["items"])


def test_create_project_validation_errors(client):
    auth = get_auth_header(client, f"valid_{uuid4()}@cafe.com")

    assert create_project(client, auth, title="").status_code == 422
    assert create_project(client, auth, description="curto").status_code == 422
    assert create_project(client, auth, remote_type="presencial").status_code == 422
    assert create_project(client, auth, team_size=0).status_code == 422


# ── Busca de profissionais ──────────────────────────────


def test_search_professionals_by_skill_any(client):
    searcher = get_auth_header(client, f"seek_{uuid4()}@cafe.com")
    p1 = get_auth_header(client, f"prof1_{uuid4()}@cafe.com")
    p2 = get_auth_header(client, f"prof2_{uuid4()}@cafe.com")
    p3 = get_auth_header(client, f"prof3_{uuid4()}@cafe.com")

    add_skills(client, p1, ["Python", "Excel"])
    add_skills(client, p2, ["React"])
    add_skills(client, p3, ["Python"])
    add_skills(client, searcher, ["Python"])

    resp = client.get("/network/users/search?skills=python", headers=searcher)
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert len(emails) == 2
    assert any("prof1" in e for e in emails) and any("prof3" in e for e in emails)
    assert not any("prof2" in e for e in emails)
    assert not any("seek" in e for e in emails)  # não inclui o próprio solicitante


def test_search_professionals_all_mode(client):
    searcher = get_auth_header(client, f"seekall_{uuid4()}@cafe.com")
    p1 = get_auth_header(client, f"all1_{uuid4()}@cafe.com")
    p2 = get_auth_header(client, f"all2_{uuid4()}@cafe.com")

    add_skills(client, p1, ["Python", "Excel"])
    add_skills(client, p2, ["Python"])

    resp = client.get(
        "/network/users/search?skills=python,excel&mode=all", headers=searcher
    )
    emails = [u["email"] for u in resp.json()]
    assert len(emails) == 1
    assert any("all1" in e for e in emails)


def test_search_professionals_requires_skills(client):
    auth = get_auth_header(client, f"needskill_{uuid4()}@cafe.com")
    resp = client.get("/network/users/search", headers=auth)
    assert resp.status_code == 422


# ── Convites na criação do projeto ──────────────────────


def test_create_project_with_invites_creates_pending(client):
    owner = get_auth_header(client, f"inv_owner_{uuid4()}@cafe.com")
    invitee_email = f"invitee_{uuid4()}@cafe.com"
    invitee = get_auth_header(client, invitee_email)

    me = client.get("/auth/me", headers=invitee)
    invitee_id = me.json()["id"]

    resp = create_project(
        client,
        owner,
        invites=[
            {"invited_user_id": invitee_id, "message": "Topa uma parceria no BPO?"},
        ],
    )
    assert resp.status_code == 201

    invitations = client.get("/network/me/invites", headers=invitee).json()
    assert len(invitations) == 1
    assert invitations[0]["status"] == "pending"
    assert invitations[0]["message"] == "Topa uma parceria no BPO?"
    assert invitations[0]["project_title"] == "Migração de plataforma contábil"
    assert invitations[0]["invited_user"]["id"] == invitee_id
    assert invitations[0]["conversation_id"]

    convs = client.get("/network/conversations", headers=invitee)
    assert convs.status_code == 200
    assert len(convs.json()) == 1
    assert convs.json()[0]["id"] == invitations[0]["conversation_id"]


def test_create_project_with_multiple_invites(client):
    owner = get_auth_header(client, f"inv_multi_owner_{uuid4()}@cafe.com")
    ids = []
    for tag in ("a", "b"):
        invitee = get_auth_header(client, f"multi_{tag}_{uuid4()}@cafe.com")
        ids.append(client.get("/auth/me", headers=invitee).json()["id"])

    resp = create_project(
        client,
        owner,
        invites=[
            {"invited_user_id": ids[0], "message": "Mensagem A"},
            {"invited_user_id": ids[1], "message": "Mensagem B"},
        ],
    )
    assert resp.status_code == 201

    invitations = client.get(
        f"/network/projects/{resp.json()['id']}/invites", headers=owner
    ).json()
    assert len(invitations) == 2
    assert {i["message"] for i in invitations} == {"Mensagem A", "Mensagem B"}


def test_create_project_with_self_invite_rejected(client):
    owner = get_auth_header(client, f"selfinv_{uuid4()}@cafe.com")
    own_id = client.get("/auth/me", headers=owner).json()["id"]

    resp = create_project(
        client,
        owner,
        invites=[{"invited_user_id": own_id, "message": "convite para mim"}],
    )
    assert resp.status_code == 400


def test_create_project_with_unknown_invitee(client):
    owner = get_auth_header(client, f"unk_owner_{uuid4()}@cafe.com")

    resp = create_project(
        client,
        owner,
        invites=[{"invited_user_id": str(uuid4()), "message": "oi"}],
    )
    assert resp.status_code == 404
