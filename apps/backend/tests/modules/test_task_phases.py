"""
TaskPhase Tests — TDD Approach
Tests for the global canonical Kanban columns/phases.
"""

from uuid import uuid4

from src.modules.task_manager.models import Task, TaskPhase
from tests.helpers import register_user


class TestTaskPhaseModel:
    """Tests for TaskPhase SQLAlchemy model."""

    def test_phase_has_required_fields(self):
        """TaskPhase model should have all expected fields."""
        assert hasattr(TaskPhase, "id")
        assert hasattr(TaskPhase, "name")
        assert hasattr(TaskPhase, "color")
        assert hasattr(TaskPhase, "order")
        assert hasattr(TaskPhase, "is_default")

    def test_task_has_phase_id_field(self):
        """Task model should have phase_id FK."""
        assert hasattr(Task, "phase_id")


class TestTaskPhaseRepository:
    """Tests for TaskPhase CRUD operations."""

    def _get_auth_header(self, client, email):
        payload = {
            "email": email,
            "password": "StrongPassword123!",
            "name": "Test User",
        }
        register_user(payload=payload)
        resp = client.post(
            "/auth/login", data={"username": email, "password": "StrongPassword123!"}
        )
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_get_phases_creates_defaults_for_new_user(self, client):
        """First call to get_phases should create 3 default phases."""
        email = f"phase_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.get("/tasks/phases/", headers=auth)
        assert resp.status_code == 200
        phases = resp.json()
        assert len(phases) == 3

        names = [p["name"] for p in phases]
        assert "a fazer" in names
        assert "em andamento" in names
        assert "concluido" in names

    def test_get_phases_returns_existing_phases(self, client):
        """Subsequent calls should return existing phases."""
        email = f"phase_user2_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # First call creates defaults
        client.get("/tasks/phases/", headers=auth)

        # Second call returns same phases
        resp = client.get("/tasks/phases/", headers=auth)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_create_custom_phase_blocked(self, client):
        """Custom phases are no longer allowed — only the 3 canonical ones."""
        email = f"phase_user3_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post(
            "/tasks/phases/",
            json={"name": "Em Revisão", "color": "#f59e0b", "order": 3},
            headers=auth,
        )

        assert resp.status_code == 400

    def test_update_phase(self, client):
        """Should allow updating a phase name and color."""
        email = f"phase_user4_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Get phases to find the ID
        resp = client.get("/tasks/phases/", headers=auth)
        phase_id = resp.json()[0]["id"]

        resp = client.put(
            f"/tasks/phases/{phase_id}",
            json={"name": "Novo Nome", "color": "#ef4444"},
            headers=auth,
        )

        assert resp.status_code == 200
        assert resp.json()["name"] == "Novo Nome"
        assert resp.json()["color"] == "#ef4444"

    def test_update_phase_blocks_order_and_done(self, client):
        """order/is_done are fixed on canonical phases."""
        email = f"phase_user5_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        phase_id = client.get("/tasks/phases/", headers=auth).json()[0]["id"]

        resp = client.put(f"/tasks/phases/{phase_id}", json={"order": 5}, headers=auth)
        assert resp.status_code == 400
        resp = client.put(
            f"/tasks/phases/{phase_id}", json={"is_done": True}, headers=auth
        )
        assert resp.status_code == 400

    def test_reorder_phases_blocked(self, client):
        """Reordering canonical phases is not allowed."""
        email = f"phase_user6_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        phases = client.get("/tasks/phases/", headers=auth).json()
        new_order = [
            {"id": p["id"], "order": len(phases) - 1 - i} for i, p in enumerate(phases)
        ]

        resp = client.post(
            "/tasks/phases/reorder", json={"phases": new_order}, headers=auth
        )
        assert resp.status_code == 400

    def test_delete_phase_blocked(self, client):
        """Canonical phases cannot be deleted."""
        email = f"phase_user7_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        phases = client.get("/tasks/phases/", headers=auth).json()
        resp = client.delete(f"/tasks/phases/{phases[0]['id']}", headers=auth)
        assert resp.status_code == 400
