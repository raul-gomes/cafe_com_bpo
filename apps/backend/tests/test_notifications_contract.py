"""Contract: the notification payload ships only what the bell renders.

Phase 5 of the read-to-render plan ("independent DTOs"). The bell shows six
things — the row key, the icon/route type, the highlight flag, the title, the
message and the time — so those are the only fields the payload carries.

Removed, because no page or hook reads them: `user_id` (the list is already
scoped to the caller), `triggered_by_user_id` and `read_at`. A field only exists
in a payload if a page reads it; these three existed "just in case".

`related_entity_type` stays on purpose: `lib/notificationIndicators.ts` filters
on it to group unread badges per conversation or post, so dropping it would
silently break the badges.
"""

from uuid import uuid4

from tests.helpers import register_user

EXPECTED_KEYS = {
    "id",
    "title",
    "message",
    "type",
    "is_read",
    "related_entity_type",
    "related_entity_id",
    "created_at",
}


def _auth(client, email: str) -> dict:
    """Registers a user and logs in, returning the authorization header.

    Args:
        client: The FastAPI test client.
        email: Email of the user to create.

    Returns:
        The request headers carrying the bearer token.
    """
    register_user(
        payload={
            "email": email,
            "password": "StrongPassword123!",
            "name": "Notification Contract",
        }
    )
    response = client.post(
        "/auth/login",
        data={"username": email, "password": "StrongPassword123!"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _token(client, email: str) -> str:
    """Logs in and returns the bearer token.

    Args:
        client: The FastAPI test client.
        email: Email of the user to log in.

    Returns:
        The access token.
    """
    response = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _list(client, headers: dict) -> list[dict]:
    """Lists the notifications of the caller.

    Args:
        client: The FastAPI test client.
        headers: Authorization headers.

    Returns:
        The list payload.
    """
    response = client.get("/notifications/", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _seed_notification(client, headers: dict, entity_id: str | None) -> dict:
    """Creates one notification, optionally pointing at an entity.

    Args:
        client: The FastAPI test client.
        headers: Authorization headers of the owner.
        entity_id: Id the notification links to, or `None` for a plain one.

    Returns:
        The body of the create response, which is the same DTO as the list.
    """
    payload = {
        "title": "Nova conversa",
        "message": "Alguém te chamou para uma conversa.",
        "type": "conversation_invite",
    }
    if entity_id is not None:
        payload["related_entity_type"] = "conversation"
        payload["related_entity_id"] = entity_id
    response = client.post("/notifications/", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_listing_notifications_returns_exactly_the_rendered_fields(client) -> None:
    """`GET /notifications/` carries the six fields the bell renders, no more."""
    headers = _auth(client, "notif_contract@example.com")
    _seed_notification(client, headers, entity_id=None)

    response = client.get("/notifications/", headers=headers)

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert set(payload[0]) == EXPECTED_KEYS


def test_marking_a_notification_read_returns_the_same_contract(client) -> None:
    """`PUT /notifications/{id}/read` uses the same DTO as the list."""
    headers = _auth(client, "notif_read_contract@example.com")
    _seed_notification(client, headers, entity_id=None)
    notif_id = client.get("/notifications/", headers=headers).json()[0]["id"]

    response = client.put(f"/notifications/{notif_id}/read", headers=headers)

    assert response.status_code == 200
    assert set(response.json()) == EXPECTED_KEYS
    assert response.json()["is_read"] is True


def test_the_entity_link_survives_the_contract_trim(client, db_session) -> None:
    """`related_entity_id` stays: it is how the bell builds the route.

    Seeded through the ORM instead of `POST /notifications/`: the create path
    re-reads the row it just inserted, and reading a nullable UUID back through
    the SQLite shim raises `AttributeError: 'float' object has no attribute
    'replace'`. That is pre-existing (it reproduces on the unmodified schema) and
    SQLite-only, so it is not something this contract change should encode.
    """
    from src.modules.auth.models import User
    from src.modules.notifications.models import AppNotification

    register_user(
        payload={
            "email": "notif_route@example.com",
            "password": "StrongPassword123!",
            "name": "Notification Route",
        }
    )
    # `register_user` returns an instance from its own (closed) session, so the
    # id is read back here instead.
    user_id = (
        db_session.query(User).filter(User.email == "notif_route@example.com").one().id
    )
    entity_id = uuid4()
    db_session.add(
        AppNotification(
            user_id=user_id,
            title="Convite de conversa",
            message="Alguém te chamou para uma conversa.",
            type="conversation_invite",
            related_entity_type="conversation",
            related_entity_id=entity_id,
        )
    )
    db_session.commit()

    headers = {"Authorization": f"Bearer {_token(client, 'notif_route@example.com')}"}
    payload = _list(client, headers)
    row = next(item for item in payload if item["type"] == "conversation_invite")

    assert set(row) == EXPECTED_KEYS
    assert row["related_entity_id"] == str(entity_id)
