from uuid import uuid4

from tests.helpers import register_user


def auth_for(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Network User"}
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
    return resp.json()["id"]


def test_invite_requires_project_owner(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    other = auth_for(client, f"other_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"candidate_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    resp = client.post(
        f"/network/projects/{project_id}/invites",
        json={
            "invited_user_id": candidate["uid"],
            "message": "Quero você no time",
        },
        headers=other,
    )
    assert resp.status_code == 403


def test_create_invitation_success(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    resp = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Quero você no time"},
        headers=owner,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["message"] == "Quero você no time"
    assert data["invited_user"]["email"] == candidate["email"]


def test_accept_creates_private_conversation(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Bora?"},
        headers=owner,
    ).json()
    assert invite["status"] == "pending"
    assert invite["conversation_id"]

    conv_id = invite["conversation_id"]
    for who in (owner, candidate):
        detail = client.get(f"/network/conversations/{conv_id}", headers=who)
        assert detail.status_code == 200
        names = {p["email"] for p in detail.json()["participants"]}
        assert names == {owner["email"], candidate["email"]}
        assert [m["body"] for m in detail.json()["messages"]] == ["Bora?"]

    resp = client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"
    assert data["conversation_id"] == conv_id


def test_invite_is_idempotent_while_pending(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    first = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Mensagem 1"},
        headers=owner,
    )
    second = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Mensagem 2"},
        headers=owner,
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["status"] == "pending"

    mine = client.get("/network/me/invites", headers=candidate)
    assert mine.status_code == 200
    assert len(mine.json()) == 1


def test_decline_then_reinvite_returns_to_pending(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Bora?"},
        headers=owner,
    ).json()
    decline = client.post(f"/network/invites/{invite['id']}/decline", headers=candidate)
    assert decline.status_code == 200
    assert decline.json()["status"] == "declined"

    reinvite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Reconsidera?"},
        headers=owner,
    )
    assert reinvite.status_code == 201
    assert reinvite.json()["status"] == "pending"
    assert reinvite.json()["responded_at"] is None


def test_cannot_accept_already_responded_invite(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Bora?"},
        headers=owner,
    ).json()
    first = client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)
    assert first.status_code == 200
    second = client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)
    assert second.status_code == 400


def test_only_invitee_can_respond(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    other = auth_for(client, f"other_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Bora?"},
        headers=owner,
    ).json()
    resp = client.post(f"/network/invites/{invite['id']}/accept", headers=other)
    assert resp.status_code == 403


def test_outsider_cannot_see_project_invites(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    other = auth_for(client, f"other_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)
    resp = client.get(f"/network/projects/{project_id}/invites", headers=other)
    assert resp.status_code == 403


def test_send_and_read_messages(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Vamos?"},
        headers=owner,
    ).json()
    conv_id = client.post(
        f"/network/invites/{invite['id']}/accept", headers=candidate
    ).json()["conversation_id"]

    sent = client.post(
        f"/network/conversations/{conv_id}/messages",
        json={"body": "<p>Boa, fechamos</p><script>alert(1)</script>"},
        headers=owner,
    )
    assert sent.status_code == 201
    assert "<script>" not in sent.json()["body"]

    detail = client.get(f"/network/conversations/{conv_id}", headers=candidate)
    assert detail.status_code == 200
    msgs = detail.json()["messages"]
    assert msgs[0]["body"] == "Vamos?"
    assert "fechamos" in msgs[1]["body"]
    assert msgs[1]["sender"]["email"] == owner["email"]
    assert msgs[1]["conversation_id"] == conv_id


def test_conversation_appears_in_my_list(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner, title="Automação Python")

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Vamos?"},
        headers=owner,
    ).json()
    client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)

    for who in (owner, candidate):
        convs = client.get("/network/conversations", headers=who)
        assert convs.status_code == 200
        assert len(convs.json()) == 1
        item = convs.json()[0]
        assert item["project_title"] == "Automação Python"
        assert item["participant"]["email"] != who["email"]


def test_outsider_cannot_access_conversation(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    other = auth_for(client, f"other_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Vamos?"},
        headers=owner,
    ).json()
    conv_id = client.post(
        f"/network/invites/{invite['id']}/accept", headers=candidate
    ).json()["conversation_id"]

    assert (
        client.get(f"/network/conversations/{conv_id}", headers=other).status_code
        == 404
    )
    assert (
        client.post(
            f"/network/conversations/{conv_id}/messages",
            json={"body": "oi"},
            headers=other,
        ).status_code
        == 403
    )


def test_conversation_exists_before_accept_and_accept_grants_project_topic(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Vamos?"},
        headers=owner,
    ).json()

    for who in (owner, candidate):
        convs = client.get("/network/conversations", headers=who)
        assert convs.status_code == 200
        assert len(convs.json()) == 1
        assert convs.json()[0]["id"] == invite["conversation_id"]

    group_id = client.get(
        f"/network/projects/{project_id}", headers=owner
    ).json()["group_id"]
    assert (
        client.get(f"/network/groups/{group_id}", headers=candidate).status_code == 404
    )

    client.post(f"/network/invites/{invite['id']}/accept", headers=candidate)

    group = client.get(f"/network/groups/{group_id}", headers=candidate)
    assert group.status_code == 200
    assert group.json()["is_member"] is True


def test_invite_creates_unread_message_notification(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner, title="Automação SPED")

    client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Vamos?"},
        headers=owner,
    )

    notifs = client.get("/notifications/", headers=candidate)
    assert notifs.status_code == 200
    items = notifs.json()
    assert any(
        n["type"] == "conversation_invite"
        and n["title"] == "Você tem uma mensagem para ler"
        and n["is_read"] is False
        and n["related_entity_type"] == "conversation"
        for n in items
    )


def test_declined_invite_keeps_private_topic_working(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": candidate["uid"], "message": "Bora?"},
        headers=owner,
    ).json()
    conv_id = invite["conversation_id"]

    assert (
        client.post(f"/network/invites/{invite['id']}/decline", headers=candidate)
        .json()["status"]
        == "declined"
    )

    sent = client.post(
        f"/network/conversations/{conv_id}/messages",
        json={"body": "Tudo bem não."},
        headers=candidate,
    )
    assert sent.status_code == 201
    detail = client.get(f"/network/conversations/{conv_id}", headers=owner)
    assert detail.status_code == 200


def test_cannot_invite_yourself_or_missing_user(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    project_id = create_project(client, owner)

    self_resp = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": owner["uid"], "message": "eu"},
        headers=owner,
    )
    assert self_resp.status_code == 400

    missing = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": str(uuid4()), "message": "eu"},
        headers=owner,
    )
    assert missing.status_code == 404
