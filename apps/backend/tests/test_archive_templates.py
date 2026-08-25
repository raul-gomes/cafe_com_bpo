"""Rotinas arquivadas: rotinas pessoais (criador), rotinas gerais (por usuário)."""

import calendar
from datetime import datetime, timezone
from uuid import uuid4

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


def _template_payload(**over):
    now = datetime.now(timezone.utc)
    due_day = min(now.day + 2, calendar.monthrange(now.year, now.month)[1])
    payload = {
        "name": f"Rotina {uuid4()}",
        "recurrence": "monthly",
        "due_day": due_day,
    }
    payload.update(over)
    return payload


# ── Rotinas pessoais ──


def test_new_template_is_not_archived(client):
    """Nova rotina deve ter is_archived=False por padrão."""
    auth = _auth_header(client, f"arch_{uuid4()}@cafe.com")
    resp = client.post("/tasks/templates/", json=_template_payload(), headers=auth)
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["is_archived"] is False


def test_creator_can_archive_personal_template(client):
    """Criador pode arquivar sua própria rotina pessoal."""
    auth = _auth_header(client, f"arch_{uuid4()}@cafe.com")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(), headers=auth
    ).json()
    resp = client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is True


def test_creator_can_unarchive_personal_template(client):
    """Criador pode desarquivar sua própria rotina pessoal."""
    auth = _auth_header(client, f"arch_{uuid4()}@cafe.com")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(), headers=auth
    ).json()
    client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=auth)
    resp = client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is False


def test_archived_template_appears_in_list(client):
    """Rotina arquivada continua aparecendo na listagem."""
    auth = _auth_header(client, f"arch_{uuid4()}@cafe.com")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(), headers=auth
    ).json()
    client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=auth)
    resp = client.get("/tasks/templates/", headers=auth)
    assert resp.status_code == 200
    items = resp.json()
    archived = [t for t in items if t["id"] == tmpl["id"]]
    assert len(archived) == 1
    assert archived[0]["is_archived"] is True


def test_archived_templates_are_sorted_last(client):
    """Rotinas arquivadas ficam no final da listagem."""
    auth = _auth_header(client, f"arch_{uuid4()}@cafe.com")
    t1 = client.post(
        "/tasks/templates/", json=_template_payload(name="Ativa"), headers=auth
    ).json()
    t2 = client.post(
        "/tasks/templates/", json=_template_payload(name="Para Arquivar"), headers=auth
    ).json()
    client.patch(f"/tasks/templates/{t2['id']}/archive", headers=auth)
    resp = client.get("/tasks/templates/", headers=auth)
    items = resp.json()
    ids = [t["id"] for t in items]
    assert ids.index(t1["id"]) < ids.index(t2["id"])


def test_other_user_cannot_archive_personal(client):
    """Usuário diferente não pode arquivar rotina pessoal de outro."""
    auth1 = _auth_header(client, f"owner_{uuid4()}@cafe.com")
    auth2 = _auth_header(client, f"other_{uuid4()}@cafe.com")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(), headers=auth1
    ).json()
    resp = client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=auth2)
    assert resp.status_code == 404


def test_archive_toggle_via_update_schema(client):
    """Também é possível arquivar via PUT com is_archived."""
    auth = _auth_header(client, f"arch_{uuid4()}@cafe.com")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(), headers=auth
    ).json()
    resp = client.put(
        f"/tasks/templates/{tmpl['id']}",
        json={"is_archived": True},
        headers=auth,
    )
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is True


# ── Rotinas gerais (per-user archive) ──


def test_user_can_archive_general_template(client):
    """Qualquer usuário pode arquivar rotina geral (só no perfil dele)."""
    admin = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    user = _auth_header(client, f"op_{uuid4()}@cafe.com")
    # Admin cria rotina geral
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=admin
    ).json()
    # Usuário arquiva
    resp = client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=user)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is True


def test_general_archive_is_per_user(client):
    """Arquivar rotina geral afeta só quem arquivou."""
    admin = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    user1 = _auth_header(client, f"op1_{uuid4()}@cafe.com")
    user2 = _auth_header(client, f"op2_{uuid4()}@cafe.com")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=admin
    ).json()
    # user1 arquiva
    client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=user1)
    # user1 vê arquivada
    resp1 = client.get("/tasks/templates/", headers=user1)
    item1 = [t for t in resp1.json() if t["id"] == tmpl["id"]][0]
    assert item1["is_archived"] is True
    # user2 NÃO vê arquivada
    resp2 = client.get("/tasks/templates/", headers=user2)
    item2 = [t for t in resp2.json() if t["id"] == tmpl["id"]][0]
    assert item2["is_archived"] is False


def test_general_archive_sorted_last_for_user_who_archived(client):
    """Rotina geral arquivada fica no final SÓ para quem arquivou."""
    admin = _auth_header(client, f"adm_{uuid4()}@cafe.com", role="admin")
    user = _auth_header(client, f"op_{uuid4()}@cafe.com")
    # Admin cria duas rotinas gerais
    t1 = client.post(
        "/tasks/templates/",
        json=_template_payload(name="Geral 1", is_general=True),
        headers=admin,
    ).json()
    t2 = client.post(
        "/tasks/templates/",
        json=_template_payload(name="Geral 2", is_general=True),
        headers=admin,
    ).json()
    # user arquiva t2
    client.patch(f"/tasks/templates/{t2['id']}/archive", headers=user)
    resp = client.get("/tasks/templates/", headers=user)
    ids = [t["id"] for t in resp.json()]
    assert ids.index(t1["id"]) < ids.index(t2["id"])


def test_admin_can_also_archive_general_template(client):
    """Admin também pode arquivar rotina geral que não é dele."""
    admin1 = _auth_header(client, f"adm1_{uuid4()}@cafe.com", role="admin")
    admin2 = _auth_header(client, f"adm2_{uuid4()}@cafe.com", role="admin")
    tmpl = client.post(
        "/tasks/templates/", json=_template_payload(is_general=True), headers=admin1
    ).json()
    resp = client.patch(f"/tasks/templates/{tmpl['id']}/archive", headers=admin2)
    assert resp.status_code == 200
    assert resp.json()["is_archived"] is True
