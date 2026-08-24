"""
Rotina já vinculada a um cliente: cada atividade vira um card; atividade
adicionada depois do vínculo gera o card dela para o período corrente.

Também cobre o toggle ativar/desativar de um client_template_assignment:
vínculo desativado não gera via scheduler; reativado volta a gerar.
"""

from uuid import uuid4

from tests.helpers import register_user


def get_auth_header(client, email, name="Owner"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def create_client(client, auth, name="Empresa Teste"):
    resp = client.post(
        "/clients/", json={"name": name, "cnpj": "12.345.678/0001-99"}, headers=auth
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_template(client, auth, name, recurrence):
    resp = client.post(
        "/tasks/templates/",
        json={"name": name, "process_type": "fiscal", "recurrence": recurrence},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_activity(client, auth, template_id, name):
    resp = client.post(
        f"/tasks/templates/{template_id}/activities/",
        json={"name": name},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def assign_template(client, auth, client_id, template_id):
    resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": client_id, "template_id": template_id},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def client_tasks(client, auth, client_id):
    resp = client.get(f"/tasks/?client_id={client_id}", headers=auth)
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_new_activity_generates_its_card_after_link(client):
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"owner_{suf}@cafe.com")

    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl = create_template(client, auth, f"Rotina {suf}", "once")
    create_activity(client, auth, tmpl["id"], "Atividade 1")

    # Vínculo gera 1 card (a atividade existente)
    assign_template(client, auth, cli["id"], tmpl["id"])
    tasks = client_tasks(client, auth, cli["id"])
    assert len(tasks) == 1
    assert tasks[0]["title"] == "Atividade 1"

    # Nova atividade adicionada APÓS o vínculo → gera o card dela
    create_activity(client, auth, tmpl["id"], "Atividade 2")
    tasks = client_tasks(client, auth, cli["id"])
    assert len(tasks) == 2, f"Esperava 2 cards (1 por atividade), veio {len(tasks)}"
    assert {t["title"] for t in tasks} == {"Atividade 1", "Atividade 2"}


def test_inactive_assignment_stops_scheduler_and_toggle_reactivates(client):
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"owner_{suf}@cafe.com")

    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl = create_template(client, auth, f"Rotina {suf}", "daily")
    create_activity(client, auth, tmpl["id"], "Atividade 1")

    result = assign_template(client, auth, cli["id"], tmpl["id"])
    assignment_id = result["assignment_id"]

    from datetime import datetime, timezone

    if datetime.now(timezone.utc).weekday() < 5:
        tasks = client_tasks(client, auth, cli["id"])
        assert len(tasks) == 1

    # Desativa o vínculo → scheduler não gera mais
    resp = client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": False},
        headers=auth,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False

    # Conclui o card da vinculação para destravar gerações futuras (regra §1.2)
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.task_manager.models import Task

    db = SessionLocal()
    db.query(Task).filter(
        Task.assignment_id == UUID(assignment_id),
        Task.completed_at.is_(None),
        Task.is_cancelled == False,
    ).update(
        {"completed_at": datetime.now(timezone.utc)},
        synchronize_session=False,
    )
    db.commit()
    db.close()

    from src.modules.task_manager.scheduler import TaskScheduler

    now = datetime(2026, 7, 20, 0, 0, 0, tzinfo=timezone.utc)  # Monday
    result = TaskScheduler().run_daily_check(now=now)
    assert result["tasks_generated"] == 0, (
        "Vínculo inativo não deve gerar tasks via scheduler"
    )

    # Reativa o vínculo → volta a gerar
    resp = client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": True},
        headers=auth,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is True

    result = TaskScheduler().run_daily_check(now=now)
    assert result["tasks_generated"] >= 1, (
        "Vínculo reativado deve voltar a gerar tasks via scheduler"
    )
