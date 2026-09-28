"""Sinalização de "há coisa nova" na Comunidade.

Cada notificação não lida é um item a sinalizar. Este arquivo cobre o gatilho
que faltava (mensagem nova em conversa privada) e o contrato que a interface usa
para marcar o que já foi visto.
"""

from uuid import uuid4

from tests.helpers import register_user


def auth_for(client, email, name="Sinal User"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return {"Authorization": f"Bearer {token}", "uid": me["id"], "email": me["email"]}


def open_conversation(client, owner, other, title="Projeto de teste"):
    project = client.post(
        "/network/projects",
        json={
            "title": title,
            "description": "Projeto usado nos testes de sinalização.",
            "skills": ["Python"],
        },
        headers=owner,
    )
    assert project.status_code == 201
    project_id = project.json()["id"]
    invite = client.post(
        f"/network/projects/{project_id}/invites",
        json={"invited_user_id": other["uid"], "message": "Vamos?"},
        headers=owner,
    ).json()
    accepted = client.post(
        f"/network/invites/{invite['id']}/accept", headers=other
    ).json()
    return project_id, accepted["conversation_id"]


def notifications_of(client, auth, unread_only=True):
    resp = client.get(
        "/notifications/",
        params={"unread_only": "true"} if unread_only else {},
        headers=auth,
    )
    assert resp.status_code == 200
    return resp.json()


def test_new_private_message_notifies_the_other_participant(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com", "Ana Dono")
    guest = auth_for(client, f"guest_{uuid4()}@cafe.com", "Bia Convidada")
    _, conv_id = open_conversation(client, owner, guest)

    sent = client.post(
        f"/network/conversations/{conv_id}/messages",
        json={"body": "Ana, consegue revisar a planilha?"},
        headers=guest,
    )
    assert sent.status_code == 201

    items = notifications_of(client, owner)
    new_msgs = [n for n in items if n["type"] == "conversation_message"]
    assert len(new_msgs) == 1
    assert new_msgs[0]["related_entity_type"] == "conversation"
    assert new_msgs[0]["related_entity_id"] == conv_id
    assert new_msgs[0]["triggered_by_user_id"] == guest["uid"]
    assert "Bia" in new_msgs[0]["title"]
    assert "revisar a planilha" in new_msgs[0]["message"]
    assert new_msgs[0]["is_read"] is False


def test_new_private_message_does_not_notify_the_sender(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com", "Ana Dono")
    guest = auth_for(client, f"guest_{uuid4()}@cafe.com", "Bia Convidada")
    _, conv_id = open_conversation(client, owner, guest)

    client.post(
        f"/network/conversations/{conv_id}/messages",
        json={"body": "Oi!"},
        headers=owner,
    )

    assert not [
        n
        for n in notifications_of(client, owner)
        if n["type"] == "conversation_message"
    ]


def test_notification_text_of_a_message_is_plain_text(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com", "Ana Dono")
    guest = auth_for(client, f"guest_{uuid4()}@cafe.com", "Bia Convidada")
    _, conv_id = open_conversation(client, owner, guest)

    client.post(
        f"/network/conversations/{conv_id}/messages",
        json={"body": "<p>Oi, <strong>bora</strong> hoje</p>"},
        headers=guest,
    )

    message = next(
        n
        for n in notifications_of(client, owner)
        if n["type"] == "conversation_message"
    )["message"]
    assert "<" not in message
    assert "bora" in message


def test_mark_read_by_entity_clears_only_that_entity(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com", "Ana Dono")
    guest = auth_for(client, f"guest_{uuid4()}@cafe.com", "Bia Convidada")
    _, conv_a = open_conversation(client, owner, guest, title="Projeto A")
    _, conv_b = open_conversation(client, owner, guest, title="Projeto B")

    for conv in (conv_a, conv_b):
        client.post(
            f"/network/conversations/{conv}/messages",
            json={"body": f"mensagem no {conv}"},
            headers=guest,
        )

    resp = client.post(
        "/notifications/mark-read",
        json={"related_entity_type": "conversation", "related_entity_id": conv_a},
        headers=owner,
    )
    assert resp.status_code == 200
    assert resp.json()["marked"] == 1

    remaining = [
        n["related_entity_id"]
        for n in notifications_of(client, owner)
        if n["type"] == "conversation_message"
    ]
    assert remaining == [conv_b]


def test_mark_read_by_entity_ignores_notifications_of_another_user(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com", "Ana Dono")
    guest = auth_for(client, f"guest_{uuid4()}@cafe.com", "Bia Convidada")
    outsider = auth_for(client, f"out_{uuid4()}@cafe.com", "Cida Outsider")
    _, conv_id = open_conversation(client, owner, guest)

    client.post(
        f"/network/conversations/{conv_id}/messages",
        json={"body": "oi"},
        headers=guest,
    )

    resp = client.post(
        "/notifications/mark-read",
        json={"related_entity_type": "conversation", "related_entity_id": conv_id},
        headers=outsider,
    )
    assert resp.status_code == 200
    assert resp.json()["marked"] == 0
    assert notifications_of(client, owner), "a notificação do dono deve continuar"


def test_project_application_notification_tells_who_applied(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com", "Ana Dono")
    candidate = auth_for(client, f"cand_{uuid4()}@cafe.com", "Bia Candidata")
    project_id, _ = open_conversation(client, owner, candidate, title="Projeto aberto")

    client.post(
        f"/network/projects/{project_id}/apply",
        json={"message": "Tenho a equipe pronta."},
        headers=candidate,
    )

    notif = next(
        n for n in notifications_of(client, owner) if n["type"] == "project_application"
    )
    assert notif["related_entity_type"] == "project"
    assert notif["related_entity_id"] == project_id
    assert notif["triggered_by_user_id"] == candidate["uid"]
    assert "Bia Candidata" in notif["message"]


def test_comment_notification_text_is_plain_text(client):
    author = auth_for(client, f"author_{uuid4()}@cafe.com", "Ana Autora")
    other = auth_for(client, f"other_{uuid4()}@cafe.com", "Bia Leitora")

    post = client.post(
        "/network/posts",
        json={"title": "Dúvida sobre SPED", "message": "Alguém já integrou?"},
        headers=author,
    ).json()
    client.post(
        f"/network/posts/{post['id']}/comments",
        json={"message": "<p>Já integrei com <b>sucesso</b></p>"},
        headers=other,
    )

    message = next(
        n for n in notifications_of(client, author) if n["type"] == "post_commented"
    )["message"]
    assert "<" not in message
    assert "sucesso" in message
