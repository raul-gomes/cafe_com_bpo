"""Tests for Dashboard API endpoints (Tarefa 5.1)."""

from uuid import uuid4
from datetime import datetime, timedelta, timezone


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth_header, name="Empresa Teste", color="#FF5733"):
    payload = {"name": name, "cnpj": "12.345.678/0001-99", "color": color}
    resp = client.post("/clients/", json=payload, headers=auth_header)
    return resp.json()


def test_dashboard_urgent_tasks_overdue(client):
    """
    Tarefa 5.1: Dashboard summary retorna tarefa atrasada com days_remaining negativo.
    """
    email = f"dash_overdue_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # Create task with deadline 3 days ago (overdue)
    past = datetime.now(timezone.utc) - timedelta(days=3)
    task_payload = {
        "title": "Tarefa Atrasada",
        "client_id": cli["id"],
        "deadline": past.isoformat(),
        "priority": "high",
    }
    client.post("/tasks/", json=task_payload, headers=auth)

    # Fetch dashboard summary
    resp = client.get("/dashboard/summary", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    urgent = data.get("urgent_tasks", [])
    overdue_tasks = [t for t in urgent if t["title"] == "Tarefa Atrasada"]
    assert len(overdue_tasks) >= 1
    task = overdue_tasks[0]
    assert task["days_remaining"] <= 0


def test_dashboard_urgent_tasks_due_soon(client):
    """
    Tarefa 5.1: Dashboard summary retorna tarefa com deadline em 2 dias.
    """
    email = f"dash_soon_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # Create task with deadline 2 days from now
    future = datetime.now(timezone.utc) + timedelta(days=2)
    task_payload = {
        "title": "Tarefa Urgente",
        "client_id": cli["id"],
        "deadline": future.isoformat(),
        "priority": "high",
    }
    client.post("/tasks/", json=task_payload, headers=auth)

    # Create task with deadline 10 days from now (not urgent)
    far_future = datetime.now(timezone.utc) + timedelta(days=10)
    task_payload2 = {
        "title": "Tarefa Tranquila",
        "client_id": cli["id"],
        "deadline": far_future.isoformat(),
        "priority": "low",
    }
    client.post("/tasks/", json=task_payload2, headers=auth)

    # Fetch dashboard summary
    resp = client.get("/dashboard/summary", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    titles = [t["title"] for t in data.get("urgent_tasks", [])]

    # 'Tarefa Urgente' should be in urgent list (within 3 days)
    assert "Tarefa Urgente" in titles
    # 'Tarefa Tranquila' might also be there depending on query; check days_remaining
    for t in data.get("urgent_tasks", []):
        if t["title"] == "Tarefa Urgente":
            assert t["days_remaining"] >= 1  # should be ~2


def test_dashboard_urgent_tasks_days_remaining_accuracy(client):
    """
    Tarefa 5.1: Verifica que days_remaining é calculado corretamente.
    """
    email = f"dash_accuracy_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # Task overdue by exactly 5 days
    past = datetime.now(timezone.utc) - timedelta(days=5)
    client.post("/tasks/", json={
        "title": "5 Dias Atrasada",
        "client_id": cli["id"],
        "deadline": past.isoformat(),
        "priority": "high",
    }, headers=auth)

    # Task due in exactly 2 days
    future = datetime.now(timezone.utc) + timedelta(days=2)
    client.post("/tasks/", json={
        "title": "2 Dias Restantes",
        "client_id": cli["id"],
        "deadline": future.isoformat(),
        "priority": "medium",
    }, headers=auth)

    resp = client.get("/dashboard/summary", headers=auth)
    assert resp.status_code == 200
    data = resp.json()

    for t in data.get("urgent_tasks", []):
        if "5 Dias Atrasada" in t["title"]:
            # Should be -5 or -4 depending on exact time
            assert t["days_remaining"] <= -4
            assert t["is_overdue"] is True
        if "2 Dias Restantes" in t["title"]:
            assert t["days_remaining"] >= 1
            assert t["is_overdue"] is False
