"""
TaskPhase Tests — TDD Approach
Tests for the global canonical Kanban columns/phases.

Decisão do produto owner (2026-10-04): o kanban tem **exatamente** três colunas
— a fazer, fazendo (em andamento) e concluído. Não existe criar, renomear,
recolorir, reordenar nem excluir fase; a API não expõe rota para nenhuma dessas
operações.
"""

from uuid import uuid4

from src.modules.task_manager.models import Task, TaskPhase
from tests.helpers import register_user

CANONICAL_NAMES = ["a fazer", "em andamento", "concluido"]


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

    def test_create_phase_endpoint_does_not_exist(self, client):
        """Decisão do PO (2026-10-04): só existem as 3 fases canônicas.

        A funcionalidade de criar fase foi removida, não bloqueada: o endpoint não
        existe mais. Um POST autenticado tem que receber 405, e nada pode ser
        criado na tabela.
        """
        email = f"phase_user3_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post(
            "/tasks/phases/",
            json={"name": "Em Revisão", "color": "#f59e0b", "order": 3},
            headers=auth,
        )

        # 405: o path `/tasks/phases/` existe (GET), mas não aceita POST.
        assert resp.status_code == 405
        # Nada foi criado: o conjunto canônico segue com as mesmas 3 fases.
        after = client.get("/tasks/phases/", headers=auth).json()
        assert [p["name"] for p in after] == CANONICAL_NAMES

    def test_update_phase_endpoint_does_not_exist(self, client):
        """Renomear/alterar cor deixou de existir — nem para o dono."""
        email = f"phase_user4_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        phase_id = client.get("/tasks/phases/", headers=auth).json()[0]["id"]

        resp = client.put(
            f"/tasks/phases/{phase_id}",
            json={"name": "Backlog", "color": "#ef4444"},
            headers=auth,
        )

        # 404: não existe rota com esse path para PUT.
        assert resp.status_code == 404
        # A fase canônica continua intacta, com o nome original.
        after = client.get("/tasks/phases/", headers=auth).json()
        renamed = next(p for p in after if p["id"] == phase_id)
        assert renamed["name"] == "a fazer"

    def test_reorder_endpoint_does_not_exist(self, client):
        """Reordenar não existe mais; a ordem canônica 0/1/2 é fixa."""
        email = f"phase_user6_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        phases = client.get("/tasks/phases/", headers=auth).json()
        new_order = [
            {"id": p["id"], "order": len(phases) - 1 - i} for i, p in enumerate(phases)
        ]

        resp = client.post(
            "/tasks/phases/reorder", json={"phases": new_order}, headers=auth
        )

        # 404: não existe rota com esse path para POST.
        assert resp.status_code == 404
        after = client.get("/tasks/phases/", headers=auth).json()
        assert [p["order"] for p in after] == [0, 1, 2]

    def test_delete_phase_endpoint_does_not_exist(self, client):
        """Excluir fase não existe mais."""
        email = f"phase_user7_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        phases = client.get("/tasks/phases/", headers=auth).json()
        resp = client.delete(f"/tasks/phases/{phases[0]['id']}", headers=auth)

        # 404: não existe rota com esse path para DELETE.
        assert resp.status_code == 404
        assert [
            p["name"] for p in client.get("/tasks/phases/", headers=auth).json()
        ] == (CANONICAL_NAMES)
