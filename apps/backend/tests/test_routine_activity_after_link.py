"""
Rotina já vinculada a um cliente: adicionar uma nova atividade deve gerar
tasks automaticamente (mesma lógica do vínculo), e desativar o vínculo
( PATCH ) deve impedir novas gerações.

Também cobre o toggle ativar/desativar de um client_template_assignment.
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


def test_new_activity_generates_task_after_link(client):
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"owner_{suf}@cafe.com")

    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl = create_template(client, auth, f"Rotina {suf}", "once")
    create_activity(client, auth, tmpl["id"], "Atividade 1")

    # Vínculo gera a task da atividade 1
    assign_template(client, auth, cli["id"], tmpl["id"])
    tasks = client_tasks(client, auth, cli["id"])
    assert len(tasks) == 1

    # Nova atividade adicionada APÓS o vínculo → deve gerar task automaticamente
    create_activity(client, auth, tmpl["id"], "Atividade 2")
    tasks = client_tasks(client, auth, cli["id"])
    titles = {t["title"] for t in tasks}
    assert len(tasks) == 2, f"Esperava 2 tasks, veio {len(tasks)}"
    assert "Atividade 2" in titles


def test_inactive_assignment_does_not_generate_and_toggle_reactivates(client):
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"owner_{suf}@cafe.com")

    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl = create_template(client, auth, f"Rotina {suf}", "once")
    create_activity(client, auth, tmpl["id"], "Atividade 1")

    result = assign_template(client, auth, cli["id"], tmpl["id"])
    assignment_id = result["assignment_id"]

    # Desativa o vínculo
    resp = client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": False},
        headers=auth,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False

    # Nova atividade com vínculo inativo → NÃO gera task
    create_activity(client, auth, tmpl["id"], "Atividade 2")
    tasks = client_tasks(client, auth, cli["id"])
    assert len(tasks) == 1

    # Reativa o vínculo → volta a gerar tasks para atividades novas
    resp = client.patch(
        f"/tasks/client-templates/{assignment_id}",
        json={"is_active": True},
        headers=auth,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is True

    create_activity(client, auth, tmpl["id"], "Atividade 3")
    tasks = client_tasks(client, auth, cli["id"])
    titles = {t["title"] for t in tasks}
    assert len(tasks) == 2, f"Esperava 2 tasks, veio {len(tasks)}"
    assert "Atividade 3" in titles
