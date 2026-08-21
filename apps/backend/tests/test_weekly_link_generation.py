"""
Test: geração de rotina SEMANAL no vínculo — comportamento esperado:
- rotina com dias marcados (ex: Seg + Qui) vinculada no meio da semana gera
  cards SOMENTE das ocorrências restantes da semana (dias passados ignorados);
- 1 card por atividade em cada ocorrência, todos com o prazo da ocorrência;
- dedup via routine_instance_id evita duplicar no mesmo período.
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.auth.models import User
from src.modules.task_manager.assignments.repository import AssignmentRepository
from src.modules.task_manager.assignments.service import AssignmentService
from src.modules.task_manager.models import ClientTemplateAssignment
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


def _create_weekly_setup(client, auth, mask="1,4"):
    """Cria template semanal (mask frontend 1=Seg..5=Sex) com 2 atividades."""
    tmpl_resp = client.post(
        "/tasks/templates/",
        json={
            "name": "Rotina Semanal Teste",
            "process_type": "fiscal",
            "recurrence": "weekly",
            "weekday_mask": mask,
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


def test_weekly_link_wednesday_generates_only_thursday(client):
    """Rotina Seg+Qui vinculada na quarta → gera SÓ quinta (2 cards, 1 por atividade)."""
    suf = uuid4().hex[:8]
    email = f"weekly_{suf}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl_id = _create_weekly_setup(client, auth, mask="1,4")  # Seg + Qui

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

    assert len(tasks) == 2, f"Esperava 2 cards (1 por atividade), veio {len(tasks)}"
    titles = {t.title for t in tasks}
    assert titles == {"Atividade Alpha", "Atividade Beta"}
    # 2026-07-16 é quinta → todos os cards no prazo da ocorrência
    assert all(t.deadline.strftime("%Y-%m-%d") == "2026-07-16" for t in tasks)


def test_weekly_link_deduplicates_same_period(client):
    """Segunda chamada para o mesmo período não duplica."""
    suf = uuid4().hex[:8]
    email = f"weekly_dedup_{suf}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl_id = _create_weekly_setup(client, auth, mask="1,4")

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).one()
    assignment, _ = _make_assignment(cli["id"], tmpl_id, user.id)

    activities = TemplateRepository(db).get_activities_by_template(UUID(tmpl_id))
    service = AssignmentService(AssignmentRepository(db))
    now = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)  # Quarta

    first = service._generate_for_activities(
        assignment, assignment.template, activities, user.id, now=now
    )
    db.commit()
    assert len(first) == 2

    second = service._generate_for_activities(
        assignment, assignment.template, activities, user.id, now=now
    )
    db.commit()
    assert second == [], "Mesmo período não deve gerar duplicata"


def test_weekly_link_monday_generates_monday_and_thursday(client):
    """Rotina Seg+Qui vinculada na segunda → 4 cards (2 por dia, 1 por atividade)."""
    suf = uuid4().hex[:8]
    email = f"weekly_mon_{suf}@cafe.com"
    auth = get_auth_header(client, email)
    cli = create_client(client, auth, name=f"Cliente {suf}")
    tmpl_id = _create_weekly_setup(client, auth, mask="1,4")

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).one()
    assignment, _ = _make_assignment(cli["id"], tmpl_id, user.id)

    activities = TemplateRepository(db).get_activities_by_template(UUID(tmpl_id))
    service = AssignmentService(AssignmentRepository(db))

    now = datetime(2026, 7, 20, 12, 0, 0, tzinfo=timezone.utc)  # Segunda
    tasks = service._generate_for_activities(
        assignment, assignment.template, activities, user.id, now=now
    )
    db.commit()

    assert len(tasks) == 4, (
        f"Segunda deveria gerar Seg + Qui × 2 atividades (4 cards), veio {len(tasks)}"
    )
    deadlines = sorted(t.deadline.strftime("%Y-%m-%d") for t in tasks)
    assert deadlines == ["2026-07-20", "2026-07-20", "2026-07-23", "2026-07-23"]
    titles = {t.title for t in tasks}
    assert titles == {"Atividade Alpha", "Atividade Beta"}
