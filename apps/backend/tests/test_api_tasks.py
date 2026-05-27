from uuid import uuid4
from datetime import datetime, timedelta, timezone


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth_header, name="Empresa Teste", color="#FF5733"):
    payload = {"name": name, "cnpj": "12.345.678/0001-99", "color": color}
    resp = client.post("/clients/", json=payload, headers=auth_header)
    return resp.json()


# ── FASE 4: ActivityTemplate recurrence expansion ──


def test_create_template_once(client):
    """Tarefa 4.1: Criar template com recorrência 'once' e due_date."""
    email = f"tmpl_once_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    due = datetime.now(timezone.utc) + timedelta(days=10)
    payload = {
        "name": "Entrega Única",
        "description": "Template pontual",
        "process_type": "fiscal",
        "recurrence": "once",
        "due_date": due.isoformat(),
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["recurrence"] == "once"
    assert data["name"] == "Entrega Única"


def test_create_template_daily(client):
    """Tarefa 4.1: Criar template com recorrência 'daily'."""
    email = f"tmpl_daily_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    payload = {
        "name": "Diário",
        "recurrence": "daily",
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    assert resp.json()["recurrence"] == "daily"


def test_create_template_weekly(client):
    """Tarefa 4.1: Criar template com recorrência 'weekly'."""
    email = f"tmpl_weekly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    payload = {
        "name": "Semanal",
        "recurrence": "weekly",
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    assert resp.json()["recurrence"] == "weekly"


def test_create_template_biweekly(client):
    """Tarefa 4.1: Criar template com recorrência 'biweekly'."""
    email = f"tmpl_biweekly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    payload = {
        "name": "Quinzenal",
        "recurrence": "biweekly",
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    assert resp.json()["recurrence"] == "biweekly"


def test_create_template_yearly(client):
    """Tarefa 4.1: Criar template com recorrência 'yearly'."""
    email = f"tmpl_yearly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    payload = {
        "name": "Anual",
        "recurrence": "yearly",
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    assert resp.json()["recurrence"] == "yearly"


def test_create_template_with_recurrence_end_date(client):
    """Tarefa 4.1: Criar template com recurrence_end_date (opcional)."""
    email = f"tmpl_end_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    end = datetime.now(timezone.utc) + timedelta(days=365)
    payload = {
        "name": "Com Expiração",
        "recurrence": "monthly",
        "recurrence_end_date": end.isoformat(),
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["recurrence"] == "monthly"
    resp = client.get("/tasks/templates/", headers=auth)
    assert resp.status_code == 200
    templates = resp.json()
    found = [t for t in templates if t["id"] == data["id"]]
    assert len(found) == 1


def test_create_template_monthly_is_default(client):
    """Tarefa 4.1: 'monthly' continua sendo o default."""
    email = f"tmpl_default_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    payload = {"name": "Mensal Default"}
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201
    assert resp.json()["recurrence"] == "monthly"


# ── FASE 4.2: Overdue template logic ──


def test_template_overdue_when_due_date_past(client):
    """Tarefa 4.2: Template com due_date no passado é overdue."""
    email = f"tmpl_overdue_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    past = datetime.now(timezone.utc) - timedelta(days=5)
    payload = {
        "name": "Atrasado",
        "recurrence": "once",
        "due_date": past.isoformat(),
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201

    # Verify via list endpoint (is_overdue flag)
    list_resp = client.get("/tasks/templates/", headers=auth)
    assert list_resp.status_code == 200
    templates = list_resp.json()
    tmpl = next(t for t in templates if t["name"] == "Atrasado")
    assert tmpl["is_overdue"] is True


def test_template_not_overdue_when_due_date_future(client):
    """Tarefa 4.2: Template com due_date no futuro não é overdue."""
    email = f"tmpl_future_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    future = datetime.now(timezone.utc) + timedelta(days=30)
    payload = {
        "name": "Futuro",
        "recurrence": "once",
        "due_date": future.isoformat(),
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201

    list_resp = client.get("/tasks/templates/", headers=auth)
    templates = list_resp.json()
    tmpl = next(t for t in templates if t["name"] == "Futuro")
    assert tmpl["is_overdue"] is False


def test_template_overdue_when_recurrence_end_date_past(client):
    """Tarefa 4.2: Template com recurrence_end_date no passado é overdue."""
    email = f"tmpl_end_past_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    past = datetime.now(timezone.utc) - timedelta(days=10)
    payload = {
        "name": "Expirado",
        "recurrence": "monthly",
        "recurrence_end_date": past.isoformat(),
    }
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201

    list_resp = client.get("/tasks/templates/", headers=auth)
    templates = list_resp.json()
    tmpl = next(t for t in templates if t["name"] == "Expirado")
    assert tmpl["is_overdue"] is True


def test_template_not_overdue_without_dates(client):
    """Tarefa 4.2: Template sem due_date nem recurrence_end_date não é overdue."""
    email = f"tmpl_no_dates_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    payload = {"name": "Sem Datas", "recurrence": "monthly"}
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201

    list_resp = client.get("/tasks/templates/", headers=auth)
    templates = list_resp.json()
    tmpl = next(t for t in templates if t["name"] == "Sem Datas")
    assert tmpl["is_overdue"] is False


def test_overdue_templates_endpoint(client):
    """Tarefa 4.2: GET /tasks/templates/overdue/ retorna só os vencidos."""
    email = f"tmpl_overdue_list_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    past = datetime.now(timezone.utc) - timedelta(days=3)
    future = datetime.now(timezone.utc) + timedelta(days=30)

    # Create overdue template
    client.post(
        "/tasks/templates/",
        json={"name": "Vencido", "recurrence": "once", "due_date": past.isoformat()},
        headers=auth,
    )
    # Create non-overdue template
    client.post(
        "/tasks/templates/",
        json={"name": "Futuro", "recurrence": "once", "due_date": future.isoformat()},
        headers=auth,
    )

    resp = client.get("/tasks/templates/overdue/", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    names = [t["name"] for t in data]
    assert "Vencido" in names
    assert "Futuro" not in names
    for tmpl in data:
        assert tmpl["days_overdue"] > 0


# ── Existing tests below ──


def test_tasks_flow_red_phase(client):
    """
    Testa o fluxo completo de tarefas.
    Este teste deve FALHAR na Red Phase pois o endpoint e os campos ainda não existem.
    """
    email = f"task_user_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    # 1. Criar uma empresa para vincular a tarefa
    company = create_client(client, auth, name="BPO Solutions", color="#4287f5")
    assert "id" in company
    # Nota: Isso deve falhar se 'color' não existir no schema/model de Client
    assert company.get("color") == "#4287f5"

    client_id = company["id"]

    # 2. Criar uma tarefa (Deve falhar: POST /tasks/ não existe)
    deadline = (datetime.utcnow() + timedelta(days=5)).isoformat()
    task_payload = {
        "title": "Conciliação Mensal",
        "description": "Realizar a conciliação de todas as contas do cliente",
        "client_id": client_id,
        "deadline": deadline,
        "priority": "high",
        "status": "todo",
    }

    resp_create = client.post("/tasks/", json=task_payload, headers=auth)
    assert resp_create.status_code == 201
    task_data = resp_create.json()
    assert task_data["title"] == "Conciliação Mensal"
    assert task_data["priority"] == "high"
    assert task_data["status"] == "todo"

    task_id = task_data["id"]

    # 3. Listar tarefas (Deve falhar: GET /tasks/ não existe)
    resp_list = client.get("/tasks/", headers=auth)
    assert resp_list.status_code == 200
    tasks = resp_list.json()
    assert len(tasks) >= 1
    assert any(t["id"] == task_id for t in tasks)

    # 4. Atualizar tarefa (Deve falhar: PUT /tasks/{id} não existe)
    update_payload = {"status": "doing", "priority": "medium"}
    resp_update = client.put(f"/tasks/{task_id}", json=update_payload, headers=auth)
    assert resp_update.status_code == 200
    assert resp_update.json()["status"] == "doing"
    assert resp_update.json()["priority"] == "medium"

    # 5. Deletar tarefa (Deve falhar: DELETE /tasks/{id} não existe)
    resp_delete = client.delete(f"/tasks/{task_id}", headers=auth)
    assert resp_delete.status_code == 204

    # 6. Verificar se foi deletada
    resp_check = client.get("/tasks/", headers=auth)
    assert not any(t["id"] == task_id for t in resp_check.json())


def test_task_isolation(client):
    """Verifica se um usuário não consegue ver as tarefas de outro."""
    user_a = f"user_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, user_a)
    comp_a = create_client(client, auth_a, "Empresa A")

    user_b = f"user_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, user_b)
    create_client(client, auth_b, "Empresa B")

    # Usuário A cria tarefa
    client.post(
        "/tasks/",
        json={
            "title": "Tarefa A",
            "client_id": comp_a["id"],
            "status": "todo",
            "priority": "low",
        },
        headers=auth_a,
    )

    # Usuário B tenta ver tarefas
    resp_b = client.get("/tasks/", headers=auth_b)
    assert resp_b.status_code == 200
    assert len(resp_b.json()) == 0  # B não deve ver a tarefa de A


# ── Tarefa 5.2: Phase + Task integration ──


def test_task_moves_to_custom_phase(client):
    """Tarefa 5.2: Criar fase, criar tarefa com essa fase, verificar."""
    email = f"phase_task_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth, "Empresa Fase")

    # 1. Criar uma fase personalizada
    resp = client.post(
        "/tasks/phases/",
        json={"name": "Em Revisão", "color": "#f59e0b", "order": 3},
        headers=auth,
    )
    assert resp.status_code == 201
    phase_id = resp.json()["id"]

    # 2. Criar tarefa com a nova fase
    task_resp = client.post(
        "/tasks/",
        json={
            "title": "Tarefa na Fase",
            "client_id": cli["id"],
            "phase_id": phase_id,
            "priority": "high",
        },
        headers=auth,
    )
    assert task_resp.status_code == 201
    task = task_resp.json()
    assert task["phase_id"] == phase_id

    # 3. Verificar que a tarefa aparece na lista com a fase correta
    list_resp = client.get("/tasks/", headers=auth)
    assert list_resp.status_code == 200
    tasks = list_resp.json()
    found = [t for t in tasks if t["id"] == task["id"]]
    assert len(found) == 1
    assert found[0]["phase_id"] == phase_id

    # 4. Mover a tarefa para outra fase via PUT
    phases_resp = client.get("/tasks/phases/", headers=auth)
    outro_phase = [p for p in phases_resp.json() if p["id"] != phase_id][0]
    update_resp = client.put(
        f"/tasks/{task['id']}",
        json={"phase_id": outro_phase["id"]},
        headers=auth,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["phase_id"] == outro_phase["id"]


# ── Tarefa 7.1: Cancel task ──


def test_cancel_task(client):
    """Tarefa 7.1: Cancelar uma tarefa preenche cancelled_at e marca status como cancelled."""
    email = f"cancel_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # 1. Criar tarefa
    resp = client.post(
        "/tasks/",
        json={
            "title": "Tarefa para cancelar",
            "client_id": cli["id"],
            "priority": "high",
        },
        headers=auth,
    )
    assert resp.status_code == 201
    task = resp.json()
    task_id = task["id"]
    assert task["cancelled_at"] is None

    # 2. Cancelar a tarefa
    cancel_resp = client.put(f"/tasks/{task_id}/cancel", headers=auth)
    assert cancel_resp.status_code == 200
    cancelled = cancel_resp.json()
    assert cancelled["cancelled_at"] is not None
    assert cancelled["status"] == "cancelled"

    # 3. Cancelar novamente deve funcionar (idempotente)
    cancel_resp2 = client.put(f"/tasks/{task_id}/cancel", headers=auth)
    assert cancel_resp2.status_code == 200
    assert cancel_resp2.json()["cancelled_at"] == cancelled["cancelled_at"]

    # 4. Cancelar tarefa inexistente retorna 404
    fake_id = str(uuid4())
    not_found = client.put(f"/tasks/{fake_id}/cancel", headers=auth)
    assert not_found.status_code == 404


def test_cancel_task_other_user(client):
    """Tarefa 7.1: Outro usuário não pode cancelar tarefa alheia."""
    email1 = f"cancel_owner_{uuid4()}@cafe.com"
    email2 = f"cancel_intruder_{uuid4()}@cafe.com"
    auth1 = get_auth_header(client, email1)
    auth2 = get_auth_header(client, email2)
    cli1 = create_client(client, auth1)

    resp = client.post(
        "/tasks/",
        json={
            "title": "Tarefa do outro",
            "client_id": cli1["id"],
            "priority": "medium",
        },
        headers=auth1,
    )
    assert resp.status_code == 201
    task_id = resp.json()["id"]

    # Tentar cancelar com outro usuário
    cancel_resp = client.put(f"/tasks/{task_id}/cancel", headers=auth2)
    assert cancel_resp.status_code == 404


# ── Tarefa 8.1: Notes field ──


def test_task_notes_create_and_update(client):
    """Tarefa 8.1: Criar task com notes e atualizar notes via PUT."""
    email = f"notes_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # 1. Criar task com notes
    resp = client.post(
        "/tasks/",
        json={
            "title": "Tarefa com notas",
            "client_id": cli["id"],
            "notes": "Observação inicial importante",
        },
        headers=auth,
    )
    assert resp.status_code == 201
    task = resp.json()
    assert task["notes"] == "Observação inicial importante"

    # 2. Atualizar notes via PUT
    update_resp = client.put(
        f"/tasks/{task['id']}",
        json={"notes": "Nota atualizada após revisão"},
        headers=auth,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["notes"] == "Nota atualizada após revisão"

    # 3. Limpar notes (enviar null)
    clear_resp = client.put(
        f"/tasks/{task['id']}",
        json={"notes": None},
        headers=auth,
    )
    assert clear_resp.status_code == 200
    assert clear_resp.json()["notes"] is None


def test_task_notes_default_none(client):
    """Tarefa 8.1: Task criada sem notes tem notes=None."""
    email = f"notes_empty_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    resp = client.post(
        "/tasks/",
        json={
            "title": "Tarefa sem notas",
            "client_id": cli["id"],
        },
        headers=auth,
    )
    assert resp.status_code == 201
    assert resp.json()["notes"] is None
