"""
Test: assigning a template with 2 activities creates 2 task cards.
Tests both the assign flow and the scheduler flow.
"""
from uuid import uuid4
from datetime import datetime, timezone
from fastapi.testclient import TestClient


def get_auth_header(client: TestClient, email: str) -> dict:
    """Register + login a user and return the Authorization header."""
    password = "Str0ng!Pass"
    client.post("/auth/register", json={
        "email": email, "password": password, "name": "Test",
    })
    resp = client.post("/auth/login", data={
        "username": email, "password": password,
    })
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client: TestClient, auth: dict) -> dict:
    """Create a test client company."""
    resp = client.post("/clients/", json={
        "name": "Multi Activity Client",
        "email": f"multi_{uuid4()}@client.com",
    }, headers=auth)
    return resp.json()


class TestMultiActivity:
    """Tests for generating multiple task cards from a single template."""

    def test_daily_assign_two_activities_creates_two_tasks(self, client: TestClient):
        """Daily routine with 2 activities → both get task cards on assign."""
        email = f"multi_daily_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        # Create daily template
        tmpl_resp = client.post("/tasks/templates/", json={
            "name": "Multi Daily", "recurrence": "daily", "process_type": "fiscal",
        }, headers=auth)
        assert tmpl_resp.status_code == 201
        tmpl_id = tmpl_resp.json()["id"]

        # Add 2 activities
        for name in ["Activity Alpha", "Activity Beta"]:
            resp = client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 1, "estimated_minutes": 30},
                headers=auth,
            )
            assert resp.status_code == 201

        # Assign template — should generate 2 tasks
        assign_resp = client.post("/tasks/client-templates/", json={
            "client_id": cli["id"], "template_id": tmpl_id,
        }, headers=auth)
        assert assign_resp.status_code == 201
        data = assign_resp.json()

        now = datetime.now(timezone.utc)
        is_weekday = now.weekday() < 5

        if is_weekday:
            assert data["tasks_generated"] == 2, (
                f"Expected 2 tasks for 2 activities, got {data['tasks_generated']}"
            )
        else:
            # Weekend: daily doesn't generate
            assert data["tasks_generated"] == 0

    def test_daily_unlink_relink_two_activities(self, client: TestClient):
        """Unlink and relink → still creates 2 tasks."""
        email = f"multi_relink_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        # Create daily template with 2 activities
        tmpl_resp = client.post("/tasks/templates/", json={
            "name": "Relink Daily", "recurrence": "daily", "process_type": "fiscal",
        }, headers=auth)
        assert tmpl_resp.status_code == 201
        tmpl_id = tmpl_resp.json()["id"]

        for name in ["Alpha", "Beta"]:
            client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 1, "estimated_minutes": 30},
                headers=auth,
            )

        # First assign
        assign1 = client.post("/tasks/client-templates/", json={
            "client_id": cli["id"], "template_id": tmpl_id,
        }, headers=auth).json()
        assign1_id = assign1["assignment_id"]

        now = datetime.now(timezone.utc)
        is_weekday = now.weekday() < 5

        # Unlink
        client.delete(f"/tasks/client-templates/{assign1_id}", headers=auth)

        # Relink
        assign2 = client.post("/tasks/client-templates/", json={
            "client_id": cli["id"], "template_id": tmpl_id,
        }, headers=auth).json()

        if is_weekday:
            assert assign2["tasks_generated"] == 2, (
                f"After relink: expected 2 tasks, got {assign2['tasks_generated']}"
            )

    def test_monthly_two_activities_creates_two_tasks(self, client: TestClient):
        """Monthly routine with 2 activities → both get task cards."""
        email = f"multi_monthly_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        tmpl_resp = client.post("/tasks/templates/", json={
            "name": "Multi Monthly", "recurrence": "monthly",
            "due_day": 15, "process_type": "fiscal",
        }, headers=auth)
        assert tmpl_resp.status_code == 201
        tmpl_id = tmpl_resp.json()["id"]

        for name in ["Mensal Alpha", "Mensal Beta"]:
            client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 15, "estimated_minutes": 30},
                headers=auth,
            )

        assign_resp = client.post("/tasks/client-templates/", json={
            "client_id": cli["id"], "template_id": tmpl_id,
        }, headers=auth)
        assert assign_resp.status_code == 201
        data = assign_resp.json()
        assert data["tasks_generated"] == 2, (
            f"Expected 2 monthly tasks, got {data['tasks_generated']}"
        )

    def test_scheduler_skips_both_activities_when_pending(self, client: TestClient):
        """Scheduler skips both activities when both have pending tasks."""
        import calendar
        now = datetime.now(timezone.utc)
        if now.weekday() >= 5:
            return  # Weekend — skip

        email = f"multi_sched_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        tmpl_resp = client.post("/tasks/templates/", json={
            "name": "Sched Multi Daily", "recurrence": "daily", "process_type": "fiscal",
        }, headers=auth)
        tmpl_id = tmpl_resp.json()["id"]

        for name in ["Sched Alpha", "Sched Beta"]:
            client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 1, "estimated_minutes": 30},
                headers=auth,
            )

        # Assign generates 2 tasks
        assign = client.post("/tasks/client-templates/", json={
            "client_id": cli["id"], "template_id": tmpl_id,
        }, headers=auth).json()
        assert assign["tasks_generated"] == 2

        # Scheduler should skip both
        sched = client.post("/tasks/scheduler/run", headers=auth).json()
        assert sched["tasks_generated"] == 0
        assert sched["tasks_skipped"] >= 2, (
            f"Expected 2 skipped, got {sched['tasks_skipped']}"
        )
