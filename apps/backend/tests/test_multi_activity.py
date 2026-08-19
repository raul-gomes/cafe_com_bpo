"""
Test: assigning a template with 2 activities creates 1 task per occurrence.
The routine itself is the recurring task — activities are descriptive
sub-steps and do NOT become separate task cards.

Tests both the assign flow and the scheduler flow.
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient


def get_auth_header(client: TestClient, email: str) -> dict:
    """Register + login a user and return the Authorization header."""
    password = "Str0ng!Pass"
    client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "name": "Test",
        },
    )
    resp = client.post(
        "/auth/login",
        data={
            "username": email,
            "password": password,
        },
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client: TestClient, auth: dict) -> dict:
    """Create a test client company."""
    resp = client.post(
        "/clients/",
        json={
            "name": "Multi Activity Client",
            "email": f"multi_{uuid4()}@client.com",
        },
        headers=auth,
    )
    return resp.json()


class TestMultiActivity:
    """Tests for generating task cards from a single template."""

    def test_daily_assign_two_activities_creates_one_task(self, client: TestClient):
        """Daily routine with 2 activities → 1 task card (the routine) on assign."""
        email = f"multi_daily_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        # Create daily template
        tmpl_resp = client.post(
            "/tasks/templates/",
            json={
                "name": "Multi Daily",
                "recurrence": "daily",
                "process_type": "fiscal",
            },
            headers=auth,
        )
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

        # Assign template — should generate 1 task (the routine)
        assign_resp = client.post(
            "/tasks/client-templates/",
            json={
                "client_id": cli["id"],
                "template_id": tmpl_id,
            },
            headers=auth,
        )
        assert assign_resp.status_code == 201
        data = assign_resp.json()

        now = datetime.now(timezone.utc)
        is_weekday = now.weekday() < 5

        if is_weekday:
            assert data["tasks_generated"] == 1, (
                f"Expected 1 task for the routine, got {data['tasks_generated']}"
            )
            tasks = client.get(f"/tasks/?client_id={cli['id']}", headers=auth).json()
            assert tasks[0]["title"] == "Multi Daily"
        else:
            # Weekend: daily doesn't generate
            assert data["tasks_generated"] == 0

    def test_daily_unlink_relink_two_activities(self, client: TestClient):
        """Unlink and relink → still creates 1 task."""
        email = f"multi_relink_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        # Create daily template with 2 activities
        tmpl_resp = client.post(
            "/tasks/templates/",
            json={
                "name": "Relink Daily",
                "recurrence": "daily",
                "process_type": "fiscal",
            },
            headers=auth,
        )
        assert tmpl_resp.status_code == 201
        tmpl_id = tmpl_resp.json()["id"]

        for name in ["Alpha", "Beta"]:
            client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 1, "estimated_minutes": 30},
                headers=auth,
            )

        # First assign
        assign1 = client.post(
            "/tasks/client-templates/",
            json={
                "client_id": cli["id"],
                "template_id": tmpl_id,
            },
            headers=auth,
        ).json()
        assign1_id = assign1["assignment_id"]

        now = datetime.now(timezone.utc)
        is_weekday = now.weekday() < 5

        # Unlink
        client.delete(f"/tasks/client-templates/{assign1_id}", headers=auth)

        # Relink
        assign2 = client.post(
            "/tasks/client-templates/",
            json={
                "client_id": cli["id"],
                "template_id": tmpl_id,
            },
            headers=auth,
        ).json()

        if is_weekday:
            assert assign2["tasks_generated"] == 1, (
                f"After relink: expected 1 task, got {assign2['tasks_generated']}"
            )

    def test_monthly_two_activities_creates_one_task(self, client: TestClient):
        """Monthly routine with 2 activities → scheduler generates 1 task card."""
        email = f"multi_monthly_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        tmpl_resp = client.post(
            "/tasks/templates/",
            json={
                "name": "Multi Monthly",
                "recurrence": "monthly",
                "due_day": 15,
                "process_type": "fiscal",
            },
            headers=auth,
        )
        assert tmpl_resp.status_code == 201
        tmpl_id = tmpl_resp.json()["id"]

        for name in ["Mensal Alpha", "Mensal Beta"]:
            client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 15, "estimated_minutes": 30},
                headers=auth,
            )

        assign_resp = client.post(
            "/tasks/client-templates/",
            json={
                "client_id": cli["id"],
                "template_id": tmpl_id,
            },
            headers=auth,
        )
        assert assign_resp.status_code == 201
        data = assign_resp.json()

        # Monthly: se o due_day ainda está por vir neste mês, o vínculo já
        # cria a task do mês corrente; se já passou, fica para o scheduler.
        today = datetime.now(timezone.utc).day
        expected_on_assign = 1 if 15 >= today else 0
        assert data["tasks_generated"] == expected_on_assign, (
            f"Expected {expected_on_assign} monthly task on assignment "
            f"(due_day=15, today={today}), got {data['tasks_generated']}"
        )

        # Scheduler mensal gera a task do PRÓXIMO mês (período distinto) —
        # sempre 1 nova, independente da branch acima.
        sched_resp = client.post("/tasks/scheduler/run-monthly", headers=auth)
        assert sched_resp.status_code == 200
        result = sched_resp.json()
        assert result["tasks_generated"] == 1, (
            f"Expected 1 monthly task from scheduler, got {result['tasks_generated']}"
        )

    def test_scheduler_skips_activities_when_pending(self, client: TestClient):
        """Scheduler nao duplica tasks ja existentes (dedup via routine_instance_id)."""
        from src.modules.task_manager.scheduler import TaskScheduler

        # Pin to Monday to ensure daily rule fires
        now = datetime(2026, 7, 20, 0, 0, 0, tzinfo=timezone.utc)
        email = f"multi_sched_{uuid4()}@test.com"
        auth = get_auth_header(client, email)
        cli = create_client(client, auth)

        tmpl_resp = client.post(
            "/tasks/templates/",
            json={
                "name": "Sched Multi Daily",
                "recurrence": "daily",
                "process_type": "fiscal",
            },
            headers=auth,
        )
        tmpl_id = tmpl_resp.json()["id"]

        for name in ["Sched Alpha", "Sched Beta"]:
            client.post(
                f"/tasks/templates/{tmpl_id}/activities/",
                json={"name": name, "due_day": 1, "estimated_minutes": 30},
                headers=auth,
            )

        # Assign generates 1 task (with routine_instance_id) — deadline = Monday 18:00
        assign = client.post(
            "/tasks/client-templates/",
            json={
                "client_id": cli["id"],
                "template_id": tmpl_id,
            },
            headers=auth,
        ).json()
        assert assign["tasks_generated"] == 1

        # Primeira execucao do scheduler (Mon) — gera a task de terça-feira
        sched = TaskScheduler()
        r1 = sched.run_daily_check(now=now)
        assert r1["tasks_generated"] >= 1, (
            f"Monday should generate at least 1 task for Tuesday, "
            f"got {r1['tasks_generated']}"
        )

        # Segunda execucao — routine_instance_id ja existe, deve pular tudo
        r2 = sched.run_daily_check(now=now)
        assert r2["tasks_generated"] == 0, (
            f"Expected 0 generated on second run, got {r2['tasks_generated']}"
        )
        assert r2["tasks_skipped"] >= 1, (
            f"Expected at least 1 skipped on second run (got {r2['tasks_skipped']}) "
            f"— routine_instance_id dedup should skip this routine"
        )
