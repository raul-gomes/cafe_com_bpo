"""
Tests for the Calendar sync endpoints (Tarefa 8.3).

Tests mock mode behavior — real Google Calendar API calls are mocked via httpx.
"""

from uuid import uuid4

from tests.helpers import register_user


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth_header, name="Empresa Teste", color="#FF5733"):
    payload = {"name": name, "cnpj": "12.345.678/0001-99", "color": color}
    resp = client.post("/clients/", json=payload, headers=auth_header)
    return resp.json()


# ── Tarefa 8.3a: UserGoogleToken model ──


def test_calendar_status_disconnected_when_no_token(client):
    """GET /calendar/status returns connected=false when no token stored."""
    email = f"cal_status_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.get("/calendar/status", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["email"] is None


def test_calendar_status_requires_auth(client):
    """GET /calendar/status without auth returns 401."""
    resp = client.get("/calendar/status")
    assert resp.status_code == 401


# ── Existing mock tests ──


def test_calendar_auth_url_not_configured(client):
    """GET /calendar/auth-url returns 501 when not configured."""
    email = f"cal_auth_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.get("/calendar/auth-url", headers=auth)
    assert resp.status_code == 501
    assert "não configurado" in resp.json()["detail"]


def test_calendar_sync_empty_task_ids(client):
    """POST /calendar/sync with empty list returns 400."""
    email = f"cal_empty_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post("/calendar/sync", json={"task_ids": []}, headers=auth)
    assert resp.status_code == 400


def test_calendar_sync_says_unavailable_when_not_configured(client):
    """AUD-023: without the integration, the sync never reports a fake success.

    The old mock mode answered 200 with every task "synced"; the screen showed
    "sincronizadas" while nothing reached the calendar. Owner decision
    (2026-10-12): the integration is shown as unavailable for now.
    """
    email = f"cal_sync_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post(
        "/calendar/sync",
        json={"task_ids": [str(uuid4())]},
        headers=auth,
    )

    assert resp.status_code == 503
    assert resp.json()["detail"] == (
        "A integração com a Google Agenda ainda não está disponível."
    )


def test_calendar_sync_requires_auth(client):
    """POST /calendar/sync without auth returns 401."""
    resp = client.post("/calendar/sync", json={"task_ids": [str(uuid4())]})
    assert resp.status_code == 401
