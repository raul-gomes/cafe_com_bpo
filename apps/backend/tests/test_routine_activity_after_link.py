"""
Rotina já vinculada a um cliente: atividades adicionadas depois do vínculo
NÃO geram tasks separadas — a rotina é a própria task (1 task por ocorrência).

Também cobre o toggle ativar/desativar de um client_template_assignment:
vínculo desativado não gera via scheduler; reativado volta a gerar.
"""

from uuid import uuid4


def get_auth_header(client, email, name="Owner"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    client.post("/auth/register", json=payload)
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


def test_new_activity_does_not_create_extra_task_after_link(client):
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"owner_{suf}@cafe.com")

    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl = create_template(client, auth, f"Rotina {suf}", "once")
    create_activity(client, auth, tmpl["id"], "Atividade 1")

    # Vínculo gera a task da rotina (1 task por ocorrência)
    assign_template(client, auth, cli["id"], tmpl["id"])
    tasks = client_tasks(client, auth, cli["id"])
    assert len(tasks) == 1
    assert tasks[0]["title"] == f"Rotina {suf}"

    # Nova atividade adicionada APÓS o vínculo → NÃO gera task nova
    create_activity(client, auth, tmpl["id"], "Atividade 2")
    tasks = client_tasks(client, auth, cli["id"])
    assert len(tasks) == 1, f"Esperava 1 task (rotina), veio {len(tasks)}"


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
