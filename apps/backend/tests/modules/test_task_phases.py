"""
TaskPhase Tests — TDD Approach
Tests for customizable Kanban columns/phases per user.
"""

from uuid import uuid4

from src.modules.tasks.models import TaskPhase, Task


class TestTaskPhaseModel:
    """Tests for TaskPhase SQLAlchemy model."""

    def test_phase_has_required_fields(self):
        """TaskPhase model should have all expected fields."""
        assert hasattr(TaskPhase, "id")
        assert hasattr(TaskPhase, "user_id")
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
        client.post("/auth/register", json=payload)
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
        assert "A Fazer" in names
        assert "Em Andamento" in names
        assert "Concluído" in names

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

    def test_create_custom_phase(self, client):
        """Should allow creating a custom phase."""
        email = f"phase_user3_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post(
            "/tasks/phases/",
            json={"name": "Em Revisão", "color": "#f59e0b", "order": 3},
            headers=auth,
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Em Revisão"
        assert data["color"] == "#f59e0b"
        assert data["is_default"] is False

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

    def test_reorder_phases(self, client):
        """Should allow reordering phases."""
        email = f"phase_user5_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.get("/tasks/phases/", headers=auth)
        phases = resp.json()

        # Store original order
        original_ids = [p["id"] for p in phases]

        # Reverse the order: first phase gets highest order, last gets 0
        new_order = [
            {"id": p["id"], "order": len(phases) - 1 - i} for i, p in enumerate(phases)
        ]

        resp = client.post(
            "/tasks/phases/reorder", json={"phases": new_order}, headers=auth
        )
        assert resp.status_code == 200

        resp = client.get("/tasks/phases/", headers=auth)
        updated = resp.json()

        # First phase in result should be the one that was originally last
        assert updated[0]["id"] == original_ids[-1]
        assert updated[0]["order"] == 0
        # Last phase in result should be the one that was originally first
        assert updated[-1]["id"] == original_ids[0]
        assert updated[-1]["order"] == len(phases) - 1

    def test_delete_phase_migrates_tasks(self, client):
        """Deleting a phase should migrate its tasks to the nearest phase."""
        email = f"phase_user6_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Create a custom phase
        resp = client.post(
            "/tasks/phases/",
            json={"name": "Temp Phase", "color": "#000000", "order": 10},
            headers=auth,
        )
        temp_phase_id = resp.json()["id"]

        # Delete the phase
        resp = client.delete(f"/tasks/phases/{temp_phase_id}", headers=auth)
        assert resp.status_code == 204

    def test_cannot_delete_last_phase(self, client):
        """Should prevent deleting the last remaining phase."""
        email = f"phase_user7_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Get phases
        resp = client.get("/tasks/phases/", headers=auth)
        phases = resp.json()

        # Try to delete all phases - should fail when only 1 remains
        for phase in phases[:-1]:
            client.delete(f"/tasks/phases/{phase['id']}", headers=auth)

        # Try to delete the last one - should fail
        last_phase = client.get("/tasks/phases/", headers=auth).json()[0]
        resp = client.delete(f"/tasks/phases/{last_phase['id']}", headers=auth)
        assert resp.status_code == 400
