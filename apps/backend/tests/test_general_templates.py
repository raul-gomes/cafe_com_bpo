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


def test_only_creator_can_edit_the_master_general(client):
    """Não-donos editam apenas a própria cópia (fork); o mestre fica intacto."""
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    other_adm = _auth_header(client, f"adm2_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    general = client.post(
        "/tasks/templates/",
        json=_template_payload(name="Master", is_general=True),
        headers=adm,
    ).json()

    # operador: editar cria a cópia privada dele (não altera o mestre)
    op_edit = client.put(
        f"/tasks/templates/{general['id']}", json={"name": "hack"}, headers=op
    )
    assert op_edit.status_code == 200
    op_fork = op_edit.json()
    assert op_fork["id"] != general["id"]
    assert op_fork["parent_template_id"] == general["id"]

    # mestre permanece intacto (nome original preservado)
    master = client.get(f"/tasks/templates/{general['id']}", headers=adm).json()
    assert master["name"] == "Master"

    # outro admin (não criador): excluir remove apenas a cópia dele (204),
    # o mestre continua a existir
    assert (
        client.delete(f"/tasks/templates/{general['id']}", headers=other_adm).status_code
        == 204
    )
    assert (
        client.get(f"/tasks/templates/{general['id']}", headers=adm).status_code == 200
    )

    # o criador (admin) edita e exclui o mestre de verdade
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


# ─────────────────────────────────────────────────────────────────────────────
# Fork por usuário: editar rotina geral cria cópia privada (mudanças só do user)
# ─────────────────────────────────────────────────────────────────────────────


def _create_general_with_activity(client, adm):
    general = client.post(
        "/tasks/templates/",
        json=_template_payload(name="Rotina Mãe", is_general=True, due_day=10),
        headers=adm,
    ).json()
    client.post(
        f"/tasks/templates/{general['id']}/activities/",
        json={"name": "Atividade padrão", "priority": "medium", "order": 0},
        headers=adm,
    )
    return general


def test_operator_editing_general_creates_private_fork(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    general = _create_general_with_activity(client, adm)
    op_uid = op_user_id(op)

    resp = client.put(
        f"/tasks/templates/{general['id']}",
        json={"name": "Minha versão"},
        headers=op,
    )
    assert resp.status_code == 200
    fork = resp.json()
    # Cria uma cópia privada do usuário — ID diferente do mestre, marcando origem.
    assert fork["id"] != general["id"]
    assert fork["is_general"] is False
    assert fork["user_id"] == op_uid
    assert fork["parent_template_id"] == general["id"]
    assert fork["name"] == "Minha versão"
    # A rotina geral original permanece intacta para os demais.
    still = client.get(f"/tasks/templates/{general['id']}", headers=adm).json()
    assert still["name"] == "Rotina Mãe"


def test_general_removed_from_list_when_user_has_fork(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    general = _create_general_with_activity(client, adm)

    # sem fork: aparece a rotina geral
    ids_before = {t["id"] for t in client.get("/tasks/templates/", headers=op).json()}
    assert general["id"] in ids_before

    client.put(
        f"/tasks/templates/{general['id']}", json={"name": "Minha versão"}, headers=op
    )

    ids_after = {t["id"] for t in client.get("/tasks/templates/", headers=op).json()}
    # a cópia (fork) aparece e o mestre geral desaparece da lista desse usuário
    fork_ids = [
        t["id"]
        for t in client.get("/tasks/templates/", headers=op).json()
        if t.get("parent_template_id") == general["id"]
    ]
    assert fork_ids
    for _id in fork_ids:
        assert _id in ids_after
    assert general["id"] not in ids_after


def test_new_user_still_sees_original_general(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    newcomer = _auth_header(client, f"new_{uuid4()}@cafe.com")
    general = _create_general_with_activity(client, adm)

    client.put(
        f"/tasks/templates/{general['id']}", json={"name": "Versão do OP"}, headers=op
    )

    detail = client.get(f"/tasks/templates/{general['id']}", headers=newcomer)
    assert detail.status_code == 200
    assert detail.json()["name"] == "Rotina Mãe"
    # lista do novo usuário traz o mestre, sem a cópia do OP
    ids = {t["id"] for t in client.get("/tasks/templates/", headers=newcomer).json()}
    assert general["id"] in ids


def test_operator_adding_activity_to_general_forks_and_only_affects_own(client):
    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    other = _auth_header(client, f"op2_{uuid4()}@cafe.com")
    general = _create_general_with_activity(client, adm)

    resp = client.post(
        f"/tasks/templates/{general['id']}/activities/",
        json={"name": "Atividade do OP", "priority": "high", "order": 1},
        headers=op,
    )
    assert resp.status_code in (200, 201)

    # o fork da cópia (para o OP) tem a atividade nova
    op_list = client.get("/tasks/templates/", headers=op).json()
    fork = next(t for t in op_list if t.get("parent_template_id") == general["id"])
    fork_detail = client.get(f"/tasks/templates/{fork['id']}", headers=op).json()
    assert {a["name"] for a in fork_detail["activities"]} >= {
        "Atividade padrão",
        "Atividade do OP",
    }

    # o mestre geral (visto por outro usuário) NÃO recebe a atividade do OP
    master = client.get(f"/tasks/templates/{general['id']}", headers=other).json()
    assert "Atividade do OP" not in {a["name"] for a in master["activities"]}


def test_fork_migrates_user_assignments_for_future_generation(client):
    import calendar

    adm = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    op = _auth_header(client, f"op_{uuid4()}@cafe.com")
    now = datetime.now(timezone.utc)
    due_day = min(now.day + 2, calendar.monthrange(now.year, now.month)[1])
    general = client.post(
        "/tasks/templates/",
        json=_template_payload(name="Rotina Mãe", is_general=True, due_day=due_day),
        headers=adm,
    ).json()
    client.post(
        f"/tasks/templates/{general['id']}/activities/",
        json={"name": "Atividade padrão", "priority": "medium", "order": 0},
        headers=adm,
    )
    cli = _create_client(client, op)
    start = datetime.now(timezone.utc) + timedelta(days=1)
    client.post(
        "/tasks/client-templates/",
        json={
            "client_id": cli["id"],
            "template_id": general["id"],
            "start_date": start.isoformat(),
        },
        headers=op,
    )

    from src.core.database import SessionLocal
    from src.modules.task_manager.models import ClientTemplateAssignment

    # antes do fork, o assignment aponta para o mestre
    session = SessionLocal()
    try:
        before = (
            session.query(ClientTemplateAssignment)
            .filter(
                ClientTemplateAssignment.client_id == UUID(cli["id"]),
                ClientTemplateAssignment.template_id == UUID(general["id"]),
            )
            .first()
        )
        assert before is not None
    finally:
        session.close()

    fork = client.put(
        f"/tasks/templates/{general['id']}",
        json={"name": "Minha versão"},
        headers=op,
    ).json()

    session = SessionLocal()
    try:
        after = (
            session.query(ClientTemplateAssignment)
            .filter(ClientTemplateAssignment.client_id == UUID(cli["id"]))
            .first()
        )
        assert after is not None
        assert str(after.template_id) == fork["id"]
    finally:
        session.close()
