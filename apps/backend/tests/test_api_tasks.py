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


# ── Sprint 3 Section 1: next_business_day + due_days ──


def test_next_business_day_weekday():
    """Sábado avança para segunda-feira."""
    from src.core.utils import next_business_day
    from datetime import date

    saturday = datetime(2026, 6, 6, 10, 0, 0)  # Sábado
    assert saturday.weekday() == 5
    result = next_business_day(saturday)
    assert result.weekday() == 0  # Segunda
    assert result.day == 8
    assert result.hour == 10  # Preserva hora


def test_next_business_day_sunday():
    """Domingo avança para segunda-feira."""
    from src.core.utils import next_business_day

    sunday = datetime(2026, 6, 7, 8, 30, 0)  # Domingo
    assert sunday.weekday() == 6
    result = next_business_day(sunday)
    assert result.weekday() == 0  # Segunda
    assert result.day == 8
    assert result.hour == 8  # Preserva hora


def test_next_business_day_friday():
    """Sexta-feira permanece inalterada."""
    from src.core.utils import next_business_day

    friday = datetime(2026, 6, 5, 14, 0, 0)  # Sexta
    assert friday.weekday() == 4
    result = next_business_day(friday)
    assert result == friday  # Sem alteração


def test_next_business_day_monday():
    """Segunda-feira permanece inalterada."""
    from src.core.utils import next_business_day

    monday = datetime(2026, 6, 1, 9, 0, 0)  # Segunda
    assert monday.weekday() == 0
    result = next_business_day(monday)
    assert result == monday  # Sem alteração


def test_create_template_with_due_days(client):
    """
    Sprint 3 Section 1: Criar template activity com due_days.
    due_days é opcional e alternativo ao due_day.
    """
    email = f"due_days_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    # Criar template primeiro
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Template Due Days", "process_type": "fiscal", "recurrence": "monthly"},
        headers=auth,
    )
    assert tmpl_resp.status_code == 201
    tmpl_id = tmpl_resp.json()["id"]

    # Criar activity com due_days (sem due_day — mas due_day é obrigatório no schema)
    act_resp = client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={
            "name": "Atividade com due_days",
            "due_day": 15,
            "due_days": 5,
        },
        headers=auth,
    )
    assert act_resp.status_code == 201
    assert act_resp.json()["due_days"] == 5
    assert act_resp.json()["due_day"] == 15


def test_create_template_activity_without_due_days(client):
    """
    Sprint 3 Section 1: Criar template activity sem due_days — usa due_day normalmente.
    """
    email = f"no_due_days_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Template Sem Due Days", "process_type": "contabil", "recurrence": "monthly"},
        headers=auth,
    )
    assert tmpl_resp.status_code == 201
    tmpl_id = tmpl_resp.json()["id"]

    act_resp = client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Atividade padrão", "due_day": 10},
        headers=auth,
    )
    assert act_resp.status_code == 201
    assert act_resp.json()["due_days"] is None
    assert act_resp.json()["due_day"] == 10


# ── Sprint 3 Section 2: RoutineType CRUD ──


def test_create_routine_type(client):
    """Criar um RoutineType com nome e cor."""
    email = f"rt_create_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post(
        "/tasks/routine-types/",
        json={"name": "Fiscal Mensal", "color": "#3b82f6"},
        headers=auth,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Fiscal Mensal"
    assert data["color"] == "#3b82f6"
    assert "id" in data
    assert "user_id" in data


def test_create_routine_type_minimal(client):
    """Criar RoutineType apenas com name (sem color opcional)."""
    email = f"rt_minimal_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post(
        "/tasks/routine-types/",
        json={"name": "Simples"},
        headers=auth,
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Simples"


def test_list_routine_types(client):
    """Listar RoutineTypes retorna apenas os do usuário logado."""
    email = f"rt_list_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    # Criar 2 tipos
    client.post("/tasks/routine-types/", json={"name": "Tipo A", "color": "#ef4444"}, headers=auth)
    client.post("/tasks/routine-types/", json={"name": "Tipo B", "color": "#10b981"}, headers=auth)

    resp = client.get("/tasks/routine-types/", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = [t["name"] for t in data]
    assert "Tipo A" in names
    assert "Tipo B" in names


def test_update_routine_type(client):
    """Atualizar nome e cor de um RoutineType."""
    email = f"rt_update_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    create_resp = client.post("/tasks/routine-types/", json={"name": "Original", "color": "#000000"}, headers=auth)
    rt_id = create_resp.json()["id"]

    update_resp = client.put(
        f"/tasks/routine-types/{rt_id}",
        json={"name": "Atualizado", "color": "#ffffff"},
        headers=auth,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "Atualizado"
    assert update_resp.json()["color"] == "#ffffff"


def test_delete_routine_type(client):
    """Deletar RoutineType."""
    email = f"rt_delete_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    create_resp = client.post("/tasks/routine-types/", json={"name": "Vai ser deletado"}, headers=auth)
    rt_id = create_resp.json()["id"]

    delete_resp = client.delete(f"/tasks/routine-types/{rt_id}", headers=auth)
    assert delete_resp.status_code == 204

    # Verificar que não aparece mais na lista
    list_resp = client.get("/tasks/routine-types/", headers=auth)
    ids = [t["id"] for t in list_resp.json()]
    assert rt_id not in ids


def test_routine_type_isolation(client):
    """Usuário A não vê os RoutineTypes do usuário B."""
    email_a = f"rt_iso_a_{uuid4()}@cafe.com"
    email_b = f"rt_iso_b_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    auth_b = get_auth_header(client, email_b)

    client.post("/tasks/routine-types/", json={"name": "Tipo do A"}, headers=auth_a)

    resp_b = client.get("/tasks/routine-types/", headers=auth_b)
    assert resp_b.status_code == 200
    assert len(resp_b.json()) == 0


def test_routine_type_404_on_other_user(client):
    """Usuário B não pode atualizar/deletar RoutineType do usuário A."""
    email_a = f"rt_404_a_{uuid4()}@cafe.com"
    email_b = f"rt_404_b_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    auth_b = get_auth_header(client, email_b)

    create_resp = client.post("/tasks/routine-types/", json={"name": "Tipo do A"}, headers=auth_a)
    rt_id = create_resp.json()["id"]

    # Tentar atualizar com B
    update_resp = client.put(f"/tasks/routine-types/{rt_id}", json={"name": "Hack"}, headers=auth_b)
    assert update_resp.status_code == 404

    # Tentar deletar com B
    delete_resp = client.delete(f"/tasks/routine-types/{rt_id}", headers=auth_b)
    assert delete_resp.status_code == 404


# ── Sprint 3 Section 3: template_id + assignment_id FK on Task ──


def test_task_has_template_fk_after_assignment(client):
    """Após vincular template a cliente, tasks geradas têm template_id e assignment_id."""
    email = f"fk_task_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # 1. Criar template com uma activity
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Template FK", "process_type": "fiscal", "recurrence": "monthly"},
        headers=auth,
    )
    assert tmpl_resp.status_code == 201
    tmpl_id = tmpl_resp.json()["id"]

    act_resp = client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Atividade FK", "due_day": 15},
        headers=auth,
    )
    assert act_resp.status_code == 201

    # 2. Vincular template ao cliente
    assign_resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )
    assert assign_resp.status_code == 201
    assignment_id = assign_resp.json()["assignment_id"]

    # 3. Verificar que as tasks geradas têm os FKs
    tasks_resp = client.get(f"/tasks/?client_id={cli['id']}", headers=auth)
    assert tasks_resp.status_code == 200
    tasks = tasks_resp.json()

    # Deve haver ao menos uma task com template_id e assignment_id
    fk_tasks = [t for t in tasks if t.get("template_id") == tmpl_id]
    assert len(fk_tasks) >= 1, "Nenhuma task com template_id preenchido"
    assert fk_tasks[0]["assignment_id"] == assignment_id


def test_task_response_includes_template_name(client):
    """TaskResponse inclui template_name quando task veio de template."""
    email = f"fk_name_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # 1. Criar template
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Template Nome Teste", "process_type": "dp", "recurrence": "monthly"},
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Atividade Nome", "due_day": 10},
        headers=auth,
    )

    # 2. Vincular — espera 201, mas não usamos o retorno
    assign_resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )
    assert assign_resp.status_code == 201

    # 3. Verificar template_name na task
    tasks_resp = client.get(f"/tasks/?client_id={cli['id']}", headers=auth)
    tasks = tasks_resp.json()
    tmpl_tasks = [t for t in tasks if t.get("template_id") == tmpl_id]
    assert len(tmpl_tasks) >= 1
    assert tmpl_tasks[0]["template_name"] == "Template Nome Teste"


def test_task_template_name_null_when_manual(client):
    """Task criada manualmente (sem template) tem template_name = None."""
    email = f"fk_manual_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    resp = client.post(
        "/tasks/",
        json={"title": "Tarefa Manual", "client_id": cli["id"], "priority": "medium"},
        headers=auth,
    )
    assert resp.status_code == 201
    assert resp.json()["template_name"] is None
    assert resp.json()["template_id"] is None
    assert resp.json()["assignment_id"] is None


# ── Scheduler tests (Items 17-21) ──


def test_scheduler_no_assignments(client):
    """Scheduler com 0 assignments → 0 geradas."""
    email = f"sched_empty_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["assignments_processed"] == 0
    assert data["tasks_generated"] == 0
    assert data["tasks_skipped"] == 0


def test_scheduler_daily_generates_on_weekday(client):
    """Scheduler gera tarefa diária se hoje é dia útil."""
    now = datetime.now(timezone.utc)
    is_weekday = now.weekday() < 5

    email = f"sched_daily_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    # Criar template daily com uma activity
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Diário Scheduler", "recurrence": "daily", "process_type": "fiscal"},
        headers=auth,
    )
    assert tmpl_resp.status_code == 201
    tmpl_id = tmpl_resp.json()["id"]

    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Diária", "due_day": 1},
        headers=auth,
    )

    # Vincular ao cliente
    assign_resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )
    assert assign_resp.status_code == 201

    # Executar scheduler
    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()

    if is_weekday:
        assert data["tasks_generated"] >= 1, (
            f"Dia útil ({now.weekday()}) deveria gerar tasks"
        )
    else:
        assert data["tasks_generated"] == 0, (
            f"Fim de semana ({now.weekday()}) não deve gerar tasks"
        )


def test_scheduler_does_not_duplicate(client):
    """Segunda execução do scheduler não duplica tarefas pendentes."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return  # Skip em fim de semana — teste irrelevante

    email = f"sched_dedup_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Dedup", "recurrence": "daily", "process_type": "fiscal"},
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Dedup", "due_day": 1},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )

    # Primeira execução
    r1 = client.post("/tasks/scheduler/run", headers=auth).json()
    assert r1["tasks_generated"] >= 1

    # Segunda execução — não deve duplicar
    r2 = client.post("/tasks/scheduler/run", headers=auth).json()
    assert r2["tasks_generated"] == 0
    assert r2["tasks_skipped"] >= 1


def test_scheduler_weekly_with_weekday_mask(client):
    """Scheduler gera tarefa semanal se weekday_mask inclui hoje."""
    now = datetime.now(timezone.utc)
    today_weekday = str(now.weekday())

    email = f"sched_weekly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Semanal Scheduler",
            "recurrence": "weekly",
            "weekday_mask": today_weekday,
            "process_type": "fiscal",
        },
        headers=auth,
    )
    assert tmpl_resp.status_code == 201
    tmpl_id = tmpl_resp.json()["id"]

    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Semanal", "due_day": 1},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_generated"] >= 1, (
        f"Weekday {today_weekday} deveria gerar com mask {today_weekday}"
    )


def test_scheduler_weekly_skips_when_mask_mismatch(client):
    """Scheduler não gera se weekday_mask não inclui hoje."""
    now = datetime.now(timezone.utc)
    other_day = str((now.weekday() + 1) % 7)  # Um dia diferente de hoje

    email = f"sched_weekly_skip_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Semanal Skip",
            "recurrence": "weekly",
            "weekday_mask": other_day,
            "process_type": "fiscal",
        },
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Skip", "due_day": 1},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_generated"] == 0, (
        f"Weekday mask {other_day} diferente de hoje ({now.weekday()}) não deve gerar"
    )


def test_scheduler_biweekly_on_1_or_15(client):
    """Scheduler gera quinzenal se hoje é 01 ou 15."""
    now = datetime.now(timezone.utc)
    is_biweekly_day = now.day in (1, 15)

    email = f"sched_biweekly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Quinzenal", "recurrence": "biweekly", "process_type": "fiscal"},
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Quinzenal", "due_day": 1},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    if is_biweekly_day:
        assert data["tasks_generated"] >= 1
    else:
        assert data["tasks_generated"] == 0


def test_scheduler_monthly_skips_existing_task(client):
    """Scheduler mensal não gera task duplicada quando já existe pendente."""
    now = datetime.now(timezone.utc)
    today_day = now.day

    email = f"sched_monthly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Mensal", "recurrence": "monthly", "process_type": "fiscal"},
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Mensal", "due_day": today_day},
        headers=auth,
    )
    # Assignment já gera a task para o período atual
    assign_resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )
    assert assign_resp.status_code == 201
    assert assign_resp.json()["tasks_generated"] == 1

    # Scheduler não deve duplicar — a task já existe
    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_generated"] == 0
    assert data["tasks_skipped"] >= 1, "Deveria ter detectado a task existente"


def test_scheduler_yearly_skips_existing_task(client):
    """Scheduler anual não gera task duplicada quando já existe pendente."""
    now = datetime.now(timezone.utc)

    email = f"sched_yearly_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Anual",
            "recurrence": "yearly",
            "due_month": now.month,
            "process_type": "fiscal",
        },
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Anual", "due_day": now.day},
        headers=auth,
    )
    assign_resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )
    assert assign_resp.status_code == 201
    assert assign_resp.json()["tasks_generated"] == 1

    # Scheduler não deve duplicar
    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_generated"] == 0
    assert data["tasks_skipped"] >= 1, "Deveria ter detectado a task existente"


def test_scheduler_yearly_skips_wrong_month(client):
    """Scheduler não gera anual se due_month não coincide."""
    now = datetime.now(timezone.utc)
    wrong_month = (now.month % 12) + 1  # Mês diferente

    email = f"sched_yearly_skip_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Anual Skip",
            "recurrence": "yearly",
            "due_month": wrong_month,
            "process_type": "fiscal",
        },
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Anual Skip", "due_day": 15},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_generated"] == 0, (
        f"Due month {wrong_month} diferente do atual {now.month} não deve gerar"
    )


def test_scheduler_isolation(client):
    """Scheduler só gera tasks para os assignments do próprio scheduler globalmente."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return

    email_a = f"sched_iso_a_{uuid4()}@cafe.com"
    email_b = f"sched_iso_b_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    auth_b = get_auth_header(client, email_b)
    cli_a = create_client(client, auth_a, "Cliente A")
    create_client(client, auth_b, "Cliente B")

    # Apenas usuário A cria template + assignment
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={"name": "Isolation", "recurrence": "daily", "process_type": "fiscal"},
        headers=auth_a,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Iso", "due_day": 1},
        headers=auth_a,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli_a["id"], "template_id": tmpl_id},
        headers=auth_a,
    )

    # Executar scheduler
    resp = client.post("/tasks/scheduler/run", headers=auth_a)
    assert resp.status_code == 200
    data = resp.json()
    assert data["tasks_generated"] >= 1

    # Usuário B não vê tasks de A
    tasks_b = client.get("/tasks/", headers=auth_b).json()
    assert len(tasks_b) == 0


def test_scheduler_template_not_active_skipped(client):
    """Scheduler ignora templates com is_active=False."""
    now = datetime.now(timezone.utc)
    if now.weekday() >= 5:
        return

    email = f"sched_inactive_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)

    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Inactive",
            "recurrence": "daily",
            "is_active": False,
            "process_type": "fiscal",
        },
        headers=auth,
    )
    tmpl_id = tmpl_resp.json()["id"]
    client.post(
        f"/tasks/templates/{tmpl_id}/activities/",
        json={"name": "Task Inactive", "due_day": 1},
        headers=auth,
    )
    client.post(
        "/tasks/client-templates/",
        json={"client_id": cli["id"], "template_id": tmpl_id},
        headers=auth,
    )

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["tasks_generated"] == 0


def test_scheduler_response_structure(client):
    """Verifica estrutura da resposta do scheduler."""
    email = f"sched_struct_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post("/tasks/scheduler/run", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert "assignments_processed" in data
    assert "tasks_generated" in data
    assert "tasks_skipped" in data
    assert "errors" in data
