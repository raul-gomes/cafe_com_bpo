"""
Test: assigning a template with 2 activities creates 1 task per activity.
Each activity of the routine becomes its own card, all sharing the
occurrence deadline.

Tests both the assign flow and the scheduler flow.
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from tests.helpers import register_user


def get_auth_header(client: TestClient, email: str) -> dict:
    """Register + login a user and return the Authorization header."""
    password = "Str0ng!Pass"
    register_user(
        payload={
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

    def test_daily_assign_two_activities_creates_one_task_per_activity(
        self, client: TestClient
    ):
        """Daily routine with 2 activities → 1 card per activity on assign."""
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

        # Assign template — should generate 1 card per activity
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
            assert data["tasks_generated"] == 2, (
                f"Expected 2 tasks (one per activity), got {data['tasks_generated']}"
            )
            tasks = client.get(f"/tasks/?client_id={cli['id']}", headers=auth).json()
            titles = {t["title"] for t in tasks}
            assert titles == {"Activity Alpha", "Activity Beta"}
        else:
            # Weekend: daily doesn't generate
            assert data["tasks_generated"] == 0

    def test_daily_unlink_relink_two_activities(self, client: TestClient):
        """Unlink and relink → still creates 1 card per activity."""
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
            assert assign2["tasks_generated"] == 2, (
                f"After relink: expected 2 tasks, got {assign2['tasks_generated']}"
            )

    def test_monthly_two_activities_creates_one_task_per_activity(
        self, client: TestClient
    ):
        """Monthly routine with 2 activities → 1 card per activity."""
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
        expected_on_assign = 2 if 15 >= today else 0
        assert data["tasks_generated"] == expected_on_assign, (
            f"Expected {expected_on_assign} monthly tasks on assignment "
            f"(due_day=15, today={today}), got {data['tasks_generated']}"
        )

        # Scheduler mensal gera as tasks do PRÓXIMO mês (período distinto) —
        # sempre 2 novas (1 por atividade), independente da branch acima.
        sched_resp = client.post("/tasks/scheduler/run-monthly", headers=auth)
        assert sched_resp.status_code == 200
        result = sched_resp.json()
        assert result["tasks_generated"] == 2, (
            f"Expected 2 monthly tasks from scheduler, got {result['tasks_generated']}"
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

        # Assign generates 2 tasks (one per activity) with routine_instance_id
        assign = client.post(
            "/tasks/client-templates/",
            json={
                "client_id": cli["id"],
                "template_id": tmpl_id,
            },
            headers=auth,
        ).json()
        assert assign["tasks_generated"] == 2

        # Conclui os cards da vinculação para destravar o scheduler (regra §1.2)
        from uuid import UUID

        from src.core.database import SessionLocal
        from src.modules.task_manager.models import Task

        db = SessionLocal()
        db.query(Task).filter(
            Task.client_id == UUID(cli["id"]),
            Task.template_id == UUID(tmpl_id),
            Task.completed_at.is_(None),
            Task.is_cancelled == False,
        ).update({"completed_at": now}, synchronize_session=False)
        db.commit()
        db.close()

        # Primeira execucao do scheduler (Mon) — gera as tasks de terça-feira
        sched = TaskScheduler()
        r1 = sched.run_daily_check(now=now)
        assert r1["tasks_generated"] >= 2, (
            f"Monday should generate at least 2 tasks for Tuesday, "
            f"got {r1['tasks_generated']}"
        )

        # Segunda execucao — routine_instance_id ja existe, deve pular tudo
        r2 = sched.run_daily_check(now=now)
        assert r2["tasks_generated"] == 0, (
            f"Expected 0 generated on second run, got {r2['tasks_generated']}"
        )
        assert r2["tasks_skipped"] >= 2, (
            f"Expected at least 2 skipped on second run (got {r2['tasks_skipped']}) "
            f"— routine_instance_id dedup should skip this routine"
        )
