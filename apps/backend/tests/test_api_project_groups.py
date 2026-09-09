from uuid import uuid4

from tests.helpers import register_user


def auth_for(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Group User"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return {
        "Authorization": f"Bearer {token}",
        "uid": me["id"],
        "email": me["email"],
    }


def create_project(client, auth, title="Automação de fluxo fiscal"):
    resp = client.post(
        "/network/projects",
        json={
            "title": title,
            "description": "Projeto para automatizar o fluxo fiscal dos clientes.",
            "skills": ["Python"],
        },
        headers=auth,
    )
    assert resp.status_code == 201
    return resp.json()


def invite_client(client, owner, candidate, message="Quero você no time"):
    project = create_project(client, owner)
    invite = client.post(
        f"/network/projects/{project['id']}/invites",
        json={"invited_user_id": candidate["uid"], "message": message},
        headers=owner,
    )
    assert invite.status_code == 201
    return project, invite.json()


def test_project_creation_creates_group_with_owner(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    project = create_project(client, owner, title="Grupo na criação")

    resp = client.get("/network/groups", headers=owner)
    assert resp.status_code == 200
    groups = resp.json()
    assert len(groups) == 1
    assert groups[0]["project_title"] == "Grupo na criação"
    assert groups[0]["member_count"] == 1
    assert groups[0]["last_post_at"] is None

    detail = client.get(f"/network/projects/{project['id']}", headers=owner)
    assert detail.status_code == 200
    assert detail.json()["group_id"] == groups[0]["id"]
    assert detail.json()["is_group_member"] is True


def test_accept_grants_group_access_to_invitee(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project, invite = invite_client(client, owner, candidate)

    accept = client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)
    assert accept.status_code == 200

    for who in (owner, candidate):
        groups = client.get("/network/groups", headers=who)
        assert groups.status_code == 200
        assert len(groups.json()) == 1

    group_detail = client.get(
        f"/network/groups/{groups.json()[0]['id']}", headers=candidate
    )
    assert group_detail.status_code == 200
    data = group_detail.json()
    assert data["project_id"] == project["id"]
    assert data["project_title"] == project["title"]
    assert {m["email"] for m in data["members"]} == {owner["email"], candidate["email"]}
    assert data["posts"] == []


def test_decline_does_not_grant_group_access(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    _, invite = invite_client(client, owner, candidate)

    decline = client.post(f"/network/invites/{invite['id']}/decline", headers=candidate)
    assert decline.status_code == 200

    assert client.get("/network/groups", headers=candidate).json() == []

    owner_groups = client.get("/network/groups", headers=owner).json()
    detail = client.get(f"/network/groups/{owner_groups[0]['id']}", headers=owner)
    emails = {m["email"] for m in detail.json()["members"]}
    assert emails == {owner["email"]}


def test_group_posts_visible_to_all_members(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    _, invite = invite_client(client, owner, candidate)
    client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)

    group_id = client.get("/network/groups", headers=owner).json()[0]["id"]

    sent = client.post(
        f"/network/groups/{group_id}/posts",
        json={"body": "Primeiro post do grupo"},
        headers=owner,
    )
    assert sent.status_code == 201
    first = sent.json()
    assert first["author"]["email"] == owner["email"]

    reply = client.post(
        f"/network/groups/{group_id}/posts",
        json={"body": "Cheguei no grupo!"},
        headers=candidate,
    )
    assert reply.status_code == 201

    for who in (owner, candidate):
        detail = client.get(f"/network/groups/{group_id}", headers=who)
        assert detail.status_code == 200
        posts = detail.json()["posts"]
        assert [p["body"] for p in posts] == [
            "Primeiro post do grupo",
            "Cheguei no grupo!",
        ]

    groups = client.get("/network/groups", headers=owner).json()
    assert groups[0]["last_post_at"] is not None


def test_non_member_cannot_read_or_post(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    other = auth_for(client, f"other_{uuid4()}@cafe.com")
    _ = invite_client(client, owner, candidate)
    group_id = client.get("/network/groups", headers=owner).json()[0]["id"]

    assert client.get(f"/network/groups/{group_id}", headers=other).status_code == 404
    assert (
        client.post(
            f"/network/groups/{group_id}/posts",
            json={"body": "invasor"},
            headers=other,
        ).status_code
        == 403
    )


def test_group_post_requires_body_and_sanitizes_html(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    create_project(client, owner)
    group_id = client.get("/network/groups", headers=owner).json()[0]["id"]

    empty = client.post(
        f"/network/groups/{group_id}/posts", json={"body": ""}, headers=owner
    )
    assert empty.status_code == 422

    sent = client.post(
        f"/network/groups/{group_id}/posts",
        json={"body": "<b>Legal</b><script>alert(1)</script>"},
        headers=owner,
    )
    assert sent.status_code == 201
    assert "<script>" not in sent.json()["body"]
    assert "Legal" in sent.json()["body"]


def test_project_response_marks_group_membership_for_viewer(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project, invite = invite_client(client, owner, candidate)

    before = client.get(f"/network/projects/{project['id']}", headers=candidate)
    assert before.json()["group_id"] is not None
    assert before.json()["is_group_member"] is False

    client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)
    after = client.get(f"/network/projects/{project['id']}", headers=candidate)
    assert after.json()["is_group_member"] is True
