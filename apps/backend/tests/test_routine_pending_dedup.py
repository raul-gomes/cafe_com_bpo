"""
Testes da regra de negócio: NÃO duplicar card pendente (docs/regras_negocio.md §1.2).

Regras validadas:
- Se já existe card da mesma atividade da rotina nas fases "a fazer"/"em andamento",
  NÃO criar novo card — nenhuma recorrência gera duplicata enquanto o card pendente
  não for concluído ou cancelado.
- Concluir OU cancelar o card destrava a próxima geração.
- Regra diária roda também na sexta-feira (gera os cards de segunda, pois não há
  tarefa no fim de semana).
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.auth.models import User
from src.modules.task_manager.assignments.repository import AssignmentRepository
from src.modules.task_manager.assignments.service import AssignmentService
from src.modules.task_manager.models import ClientTemplateAssignment
from src.modules.task_manager.scheduler import TaskScheduler
from src.modules.task_manager.templates.repository import TemplateRepository


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


def _create_daily_setup(client, auth):
    """Cria template DIÁRIO com 2 atividades."""
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Rotina Diária Teste",
            "process_type": "fiscal",
            "recurrence": "daily",
        },
        headers=auth,
    )
    assert tmpl_resp.status_code == 201, tmpl_resp.text
    tmpl_id = tmpl_resp.json()["id"]
    for name in ["Atividade Alpha", "Atividade Beta"]:
        resp = client.post(
            f"/tasks/templates/{tmpl_id}/activities/",
            json={"name": name, "estimated_minutes": 30},
            headers=auth,
        )
        assert resp.status_code == 201, resp.text
    return tmpl_id


def _make_assignment(client_id: str, tmpl_id: str, user_id) -> ClientTemplateAssignment:
    db = SessionLocal()
    assignment = ClientTemplateAssignment(
        client_id=UUID(client_id),
        template_id=UUID(tmpl_id),
        user_id=user_id,
        is_active=True,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment, db


def _link_daily(client, auth, email):
    """Vincula template diário ao cliente e gera os cards do dia (como na UI)."""
    cli = create_client(client, auth)
    tmpl_id = _create_daily_setup(client, auth)

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).one()
    assignment, _ = _make_assignment(cli["id"], tmpl_id, user.id)

    activities = TemplateRepository(db).get_activities_by_template(UUID(tmpl_id))
    service = AssignmentService(AssignmentRepository(db))
    now = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)  # Quarta
    tasks = service._generate_for_activities(
        assignment, assignment.template, activities, user.id, now=now
    )
    db.commit()
    assert len(tasks) == 2
    return db, user, assignment, activities, service, now


def test_scheduler_same_day_does_not_duplicate(client):
    """Rodar a regra diária no mesmo dia do vínculo não duplica os cards."""
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"daily_dedup_{suf}@cafe.com")
    db, *_ = _link_daily(client, auth, f"daily_dedup_{suf}@cafe.com")

    scheduler = TaskScheduler()
    result = scheduler.run_daily_check(mode="daily")

    db.close()
    assert result["tasks_generated"] == 0, (
        f"Cards pendentes devem bloquear nova geração; gerou {result['tasks_generated']}"
    )
    assert result["tasks_skipped"] >= 2


def test_pending_card_blocks_next_period(client):
    """Card pendente de ontem bloqueia a geração do próximo dia útil."""
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"daily_block_{suf}@cafe.com")
    db, *_ = _link_daily(client, auth, f"daily_block_{suf}@cafe.com")

    scheduler = TaskScheduler()
    next_day = datetime(
        2026, 7, 16, 3, 0, 0, tzinfo=timezone.utc
    )  # Quinta (meia-noite UTC)
    result = scheduler.run_daily_check(now=next_day, mode="daily")

    db.close()
    assert result["tasks_generated"] == 0, (
        "Card ainda em 'a fazer'/'em andamento' deve impedir novo card no dia seguinte"
    )


def test_completed_card_unblocks_next_period(client):
    """Concluir os cards libera a geração do próximo período."""
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"daily_done_{suf}@cafe.com")
    db, _user, assignment, _activities, _service, _now = _link_daily(
        client, auth, f"daily_done_{suf}@cafe.com"
    )

    # Usuário concluiu os dois cards
    from src.modules.task_manager.models import Task

    for t in db.query(Task).filter(Task.assignment_id == assignment.id).all():
        t.completed_at = datetime.now(timezone.utc)
    db.commit()

    scheduler = TaskScheduler()
    next_day = datetime(2026, 7, 16, 3, 0, 0, tzinfo=timezone.utc)
    result = scheduler.run_daily_check(now=next_day, mode="daily")

    db.close()
    assert result["tasks_generated"] == 2, (
        f"Cards concluídos devem liberar nova geração; gerou {result['tasks_generated']}"
    )


def test_cancelled_card_unblocks_only_its_activity(client):
    """Cancelar o card de UMA atividade destrava só ela; a outra segue bloqueada."""
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"daily_cancel_{suf}@cafe.com")
    db, _user, assignment, _activities, _service, _now = _link_daily(
        client, auth, f"daily_cancel_{suf}@cafe.com"
    )

    from src.modules.task_manager.models import Task

    cards = db.query(Task).filter(Task.assignment_id == assignment.id).all()
    alpha = next(t for t in cards if t.title == "Atividade Alpha")
    alpha.is_cancelled = True
    db.commit()

    scheduler = TaskScheduler()
    next_day = datetime(2026, 7, 16, 3, 0, 0, tzinfo=timezone.utc)
    result = scheduler.run_daily_check(now=next_day, mode="daily")

    db.close()
    assert result["tasks_generated"] == 1, (
        "Só a atividade cancelada deve ser regerada; a pendente continua bloqueada"
    )


def test_service_level_pending_blocks_all_recurrences(client):
    """No serviço, segunda chamada com card pendente não gera nada (qualquer recorrência)."""
    suf = uuid4().hex[:8]
    email = f"svc_block_{suf}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth)
    tmpl_id = _create_daily_setup(client, auth)

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).one()
    assignment, _ = _make_assignment(cli["id"], tmpl_id, user.id)
    activities = TemplateRepository(db).get_activities_by_template(UUID(tmpl_id))
    service = AssignmentService(AssignmentRepository(db))

    wed = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)
    thu = datetime(2026, 7, 16, 12, 0, 0, tzinfo=timezone.utc)

    first = service._generate_for_activities(
        assignment, assignment.template, activities, user.id, now=wed
    )
    db.commit()
    assert len(first) == 2

    second = service._generate_for_activities(
        assignment, assignment.template, activities, user.id, now=thu
    )
    db.commit()
    db.close()
    assert second == [], "Card pendente deve bloquear geração no período seguinte"


def test_friday_auto_detect_runs_daily_rule_for_monday(client):
    """Auto-detect na sexta aplica a regra diária e gera cards com prazo de segunda."""
    suf = uuid4().hex[:8]
    auth = get_auth_header(client, f"daily_fri_{suf}@cafe.com")
    db, _user, assignment, _activities, _service, _ = _link_daily(
        client, auth, f"daily_fri_{suf}@cafe.com"
    )

    # Conclui os cards de quarta para liberar a geração
    from src.modules.task_manager.models import Task

    for t in db.query(Task).filter(Task.assignment_id == assignment.id).all():
        t.completed_at = datetime.now(timezone.utc)
    db.commit()

    friday = datetime(2026, 7, 17, 3, 0, 0, tzinfo=timezone.utc)  # Sexta (auto-detect)
    scheduler = TaskScheduler()
    result = scheduler.run_daily_check(now=friday)  # mode=None → auto-detect

    db.close()
    assert result["tasks_generated"] == 2, (
        f"Sexta deve rodar a regra diária; gerou {result['tasks_generated']}"
    )


def test_saturday_auto_detect_does_nothing(client):
    """Sábado não roda regra diária nem semanal."""
    saturday = datetime(2026, 7, 18, 3, 0, 0, tzinfo=timezone.utc)
    scheduler = TaskScheduler()
    result = scheduler.run_daily_check(now=saturday)
    assert result["tasks_generated"] == 0
