"""
Tests for the Calendar sync endpoints (Tarefa 8.3).

Tests mock mode behavior — real Google Calendar API calls are not tested.
"""
from uuid import uuid4


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


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


def test_calendar_sync_mock_mode(client):
    """POST /calendar/sync returns mock success in mock mode."""
    email = f"cal_sync_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    task_id = str(uuid4())
    resp = client.post(
        "/calendar/sync",
        json={"task_ids": [task_id]},
        headers=auth,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced"] == 1
    assert data["failed"] == 0
    assert len(data["details"]) == 1
    assert data["details"][0]["task_id"] == task_id
    assert data["details"][0]["status"] == "mock_synced"


def test_calendar_sync_requires_auth(client):
    """POST /calendar/sync without auth returns 401."""
    resp = client.post("/calendar/sync", json={"task_ids": [str(uuid4())]})
    assert resp.status_code == 401
