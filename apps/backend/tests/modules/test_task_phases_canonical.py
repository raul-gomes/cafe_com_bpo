"""
Testes TDD — Padronização das 3 fases canônicas GLOBAIS do Kanban.

Garante que existam exatamente as fases:
a fazer (order 0), em andamento (order 1), concluido (order 2, is_done=True).

As fases são compartilhadas por todos os usuários (globais).

Regras novas:
- GET /tasks/phases/ cria/normaliza o conjunto canônico global.
- Criar fase personalizada → 400.
- Excluir fase → 400.
- Reordenar fases → 400.
- Atualizar fase: só nome/cor; mudar order/is_done → 400.
- Mover task para fase inexistente → 422 (fase_inexistente).
"""

from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.task_manager.models import Task, TaskPhase
from tests.helpers import register_user


def get_auth(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Teste"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth, name="Empresa"):
    resp = client.post(
        "/clients/", json={"name": name, "cnpj": "12.345.678/0001-99"}, headers=auth
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def insert_extra_phase(name="Validado", color="#8b5cf6", order=3, is_done=False):
    """Insere fase customizada DIRETO no banco (simula dado legado)."""
    session = SessionLocal()
    try:
        extra = TaskPhase(
            name=name,
            color=color,
            order=order,
            is_done=is_done,
            is_default=False,
        )
        session.add(extra)
        session.commit()
        return str(extra.id)
    finally:
        session.close()


def move_task_to_phase_via_db(task_id: str, phase_id: str) -> None:
    session = SessionLocal()
    try:
        task = session.query(Task).filter(Task.id == UUID(task_id)).first()
        task.phase_id = UUID(phase_id)
        session.commit()
    finally:
        session.close()


class TestCanonicalPhases:
    def test_get_phases_returns_exactly_three_canonical(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        resp = client.get("/tasks/phases/", headers=auth)
        assert resp.status_code == 200
        phases = resp.json()
        assert len(phases) == 3
        assert [p["name"] for p in phases] == ["a fazer", "em andamento", "concluido"]
        assert [p["order"] for p in phases] == [0, 1, 2]
        assert all(p["is_default"] for p in phases)
        assert sum(p["is_done"] for p in phases) == 1
        assert phases[2]["is_done"] is True

    def test_phases_are_shared_across_users(self, client):
        auth1 = get_auth(client, f"canon_{uuid4()}@cafe.com")
        auth2 = get_auth(client, f"canon_{uuid4()}@cafe.com")
        ids1 = [p["id"] for p in client.get("/tasks/phases/", headers=auth1).json()]
        ids2 = [p["id"] for p in client.get("/tasks/phases/", headers=auth2).json()]
        assert ids1 == ids2

    def test_extra_phase_is_normalized_and_removed(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        client.get("/tasks/phases/", headers=auth)
        insert_extra_phase()

        resp = client.get("/tasks/phases/", headers=auth)
        assert resp.status_code == 200
        phases = resp.json()
        assert len(phases) == 3
        assert all(p["is_default"] for p in phases)

    def test_tasks_from_extra_phase_migrate_to_em_andamento(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        cli = create_client(client, auth)

        task = client.post(
            "/tasks/",
            json={"title": "Tarefa legada", "client_id": cli["id"]},
            headers=auth,
        )
        assert task.status_code == 201, task.text
        task_id = task.json()["id"]
        # Fase extra inserida SÓ depois (POST normaliza e a removeria)
        extra_id = insert_extra_phase()
        move_task_to_phase_via_db(task_id, extra_id)

        # Normaliza
        client.get("/tasks/phases/", headers=auth)

        tasks = client.get("/tasks/", headers=auth).json()
        t = next(x for x in tasks if x["id"] == task_id)
        em_andamento = client.get("/tasks/phases/", headers=auth).json()[1]
        assert str(t["phase_id"]) == str(em_andamento["id"])

    def test_legacy_done_phase_migrates_to_concluido_and_clears_completed(self, client):
        """Fase done legada APÓS a conclusão é consolidada e tasks
        deixam de estar 'concluídas' (voltam para em andamento)."""
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        cli = create_client(client, auth)

        task = client.post(
            "/tasks/",
            json={"title": "Tarefa em auditoria", "client_id": cli["id"]},
            headers=auth,
        )
        assert task.status_code == 201, task.text
        task_id = task.json()["id"]
        # Fase done extra após a conclusão (dado legado inconsistente)
        extra_id = insert_extra_phase(name="Auditado", order=3, is_done=True)
        move_task_to_phase_via_db(task_id, extra_id)

        # Normaliza
        client.get("/tasks/phases/", headers=auth)

        phases = client.get("/tasks/phases/", headers=auth).json()
        assert len(phases) == 3
        concluido = next(p for p in phases if p["is_done"])
        assert concluido["order"] == 2

        tasks = client.get("/tasks/", headers=auth).json()
        t = next(x for x in tasks if x["id"] == task_id)
        assert str(t["phase_id"]) != str(extra_id)
        assert t["completed_at"] is None

    def test_create_custom_phase_blocked(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        resp = client.post(
            "/tasks/phases/",
            json={"name": "Em Revisão", "color": "#f59e0b", "order": 3},
            headers=auth,
        )
        assert resp.status_code == 400

    def test_delete_phase_blocked(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        phase_id = client.get("/tasks/phases/", headers=auth).json()[0]["id"]
        resp = client.delete(f"/tasks/phases/{phase_id}", headers=auth)
        assert resp.status_code == 400

    def test_reorder_blocked(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        phases = client.get("/tasks/phases/", headers=auth).json()
        new_order = [{"id": p["id"], "order": 2 - i} for i, p in enumerate(phases)]
        resp = client.post(
            "/tasks/phases/reorder", json={"phases": new_order}, headers=auth
        )
        assert resp.status_code == 400
        after = client.get("/tasks/phases/", headers=auth).json()
        assert [p["order"] for p in after] == [0, 1, 2]

    def test_update_phase_allows_name_and_color(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        phase_id = client.get("/tasks/phases/", headers=auth).json()[0]["id"]
        resp = client.put(
            f"/tasks/phases/{phase_id}",
            json={"name": "Backlog", "color": "#ef4444"},
            headers=auth,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Backlog"
        assert resp.json()["color"] == "#ef4444"

    def test_update_phase_blocks_order_and_is_done(self, client):
        auth = get_auth(client, f"canon_{uuid4()}@cafe.com")
        phase_id = client.get("/tasks/phases/", headers=auth).json()[0]["id"]
        resp = client.put(
            f"/tasks/phases/{phase_id}", json={"is_done": True}, headers=auth
        )
        assert resp.status_code == 400
        resp = client.put(f"/tasks/phases/{phase_id}", json={"order": 5}, headers=auth)
        assert resp.status_code == 400
