"""Rotinas gerais: criadas por admin, visíveis a todos, vinculáveis por qualquer operador."""

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from fastapi import status

from tests.helpers import create_test_user

PASSWORD = "StrongPassword123!"


def _auth_header(client, email, role="user"):
    create_test_user(
        email=email.lower(), password=PASSWORD, name="Test User", role=role
    )
    resp = client.post(
        "/auth/login", data={"username": email.lower(), "password": PASSWORD}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _create_client(client, auth):
    resp = client.post(
        "/clients/",
        json={"name": f"Empresa {uuid4()}", "cnpj": "12.345.678/0001-99"},
        headers=auth,
    )
    assert resp.status_code == 201
    return resp.json()


def _template_payload(**over):
    payload = {
        "name": f"Rotina {uuid4()}",
        "recurrence": "monthly",
        "due_day": 10,
    }
    payload.update(over)
    return payload


def test_admin_can_create_general_template(client):
    auth = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    resp = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=auth
    )
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["is_general"] is True


def test_operator_cannot_create_general_template(client):
    auth = _auth_header(client, f"op_{uuid4()}@cafe.com")
    resp = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=auth
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


def test_operator_creating_normal_template_has_is_general_false(client):
    auth = _auth_header(client, f"op_{uuid4()}@cafe.com")
    resp = client.post("/tasks/templates/", json=_template_payload(), headers=auth)
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["is_general"] is False


def test_general_template_visible_to_all_users_in_list(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    other_op = _auth_header(client, f"op2_{uuid4()}@cafe.com")

    general = client.post(
        "/tasks/templates/",
        json=_template_payload(name="Geral X", is_general=True),
        headers=adm,
    ).json()
    private = client.post(
        "/tasks/templates/", json=_template_payload(name="Privada Y"), headers=other_op
    ).json()
    own = client.post(
        "/tasks/templates/", json=_template_payload(name="Minha Z"), headers=op
    ).json()

    resp = client.get("/tasks/templates/", headers=op)
    assert resp.status_code == 200
    ids = {t["id"] for t in resp.json()}
    assert own["id"] in ids
    assert general["id"] in ids  # geral aparece para todos
    assert private["id"] not in ids  # privada de outro continua oculta


def test_operator_can_view_general_template_detail(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    general = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=adm
    ).json()
    resp = client.get(f"/tasks/templates/{general['id']}", headers=op)
    assert resp.status_code == 200


def test_only_creator_admin_can_edit_or_delete_general(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    other_adm = _auth_header(client, f"adm2_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    general = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=adm
    ).json()

    # operador não edita nem exclui
    assert (
        client.put(
            f"/tasks/templates/{general['id']}", json={"name": "hack"}, headers=op
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/tasks/templates/{general['id']}", headers=op).status_code
        == 404
    )

    # nem outro admin (só o criador)
    assert (
        client.delete(
            f"/tasks/templates/{general['id']}", headers=other_adm
        ).status_code
        == 404
    )

    # o criador edita e exclui normalmente
    ok = client.put(
        f"/tasks/templates/{general['id']}", json={"name": "Novo nome"}, headers=adm
    )
    assert ok.status_code == 200
    assert ok.json()["name"] == "Novo nome"
    assert (
        client.delete(f"/tasks/templates/{general['id']}", headers=adm).status_code
        == 204
    )


def test_operator_can_assign_general_template_to_own_client(client):
    import calendar

    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")

    # due_day ainda dentro do mês corrente para o gerador criar o card agora
    now = datetime.now(timezone.utc)
    due_day = min(now.day + 2, calendar.monthrange(now.year, now.month)[1])
    general = client.post(
        "/tasks/templates/",
        json=_template_payload(is_general=True, due_day=due_day),
        headers=adm,
    ).json()
    # dono (admin) adiciona uma atividade à rotina geral
    act = client.post(
        f"/tasks/templates/{general['id']}/activities/",
        json={"name": "Atividade padrão", "priority": "medium", "order": 0},
        headers=adm,
    )
    assert act.status_code in (200, 201)

    cli = _create_client(client, op)

    start = datetime.now(timezone.utc) + timedelta(days=1)
    resp = client.post(
        "/tasks/client-templates/",
        json={
            "client_id": cli["id"],
            "template_id": general["id"],
            "start_date": start.isoformat(),
        },
        headers=op,
    )
    assert resp.status_code == 201
    assert resp.json()["tasks_generated"] >= 1

    from src.core.database import SessionLocal
    from src.modules.task_manager.models import Task

    session = SessionLocal()
    try:
        db_task = session.query(Task).filter(Task.client_id == UUID(cli["id"])).first()
        assert db_task is not None
        assert str(db_task.user_id) == str(op_user_id(op))
    finally:
        session.close()


def op_user_id(auth):
    """Extrai user_id do token (payload sem verificação de assinatura — só teste)."""
    import base64
    import json

    token = auth["Authorization"].split()[1]
    payload_b64 = token.split(".")[1]
    payload_b64 += "=" * (-len(payload_b64) % 4)
    return json.loads(base64.urlsafe_b64decode(payload_b64))["sub"]
