"""
Testes: membro da equipe movendo tasks de rotinas compartilhadas no kanban.

As fases são GLOBAIS (3 canônicas compartilhadas): owner e membro veem as
mesmas colunas, então não há mapeamento de fase. Cenários (item 8 do plano):
1. Membro move uma task da rotina liberada para a fase "concluído" → task
   entra na fase done e completed_at é definido.
2. Membro move para uma fase inexistente → 422 (fase_inexistente).
3. Membro move para "em andamento" → completed_at é limpo se saía da done.
4. Membro NÃO pode mover task de rotina que não foi liberada a ele → 404.
5. Owner continua movendo as próprias tasks normalmente.
"""

from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.team.repository import TeamRepository


def get_auth_header(client, email, name="Membro"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth, name="Empresa Teste"):
    resp = client.post(
        "/clients/", json={"name": name, "cnpj": "12.345.678/0001-99"}, headers=auth
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_template(client, auth, name, process_type, recurrence, due_days=None):
    payload = {
        "name": name,
        "process_type": process_type,
        "recurrence": recurrence,
    }
    if due_days is not None:
        payload["due_days_from_start"] = due_days
    resp = client.post("/tasks/templates/", json=payload, headers=auth)
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_activity(client, auth, template_id, name, due_days=None):
    payload = {"name": name}
    if due_days is not None:
        payload["due_days"] = due_days
    resp = client.post(
        f"/tasks/templates/{template_id}/activities/", json=payload, headers=auth
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


def get_raw_token_for_invite(client_id: str, invited_email: str, template_ids=None):
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(client_id))
        inv = repo.get_pending_invitation_by_email(team.id, invited_email)
        assert inv is not None, "Convite pendente não encontrado"
        _, raw = repo.create_invitation(
            team_id=team.id,
            invited_by=inv.invited_by,
            invited_email=invited_email,
            template_ids=[UUID(t) for t in (template_ids or [])],
        )
        return raw
    finally:
        session.close()


def get_phases(client, auth):
    resp = client.get("/tasks/phases/", headers=auth)
    assert resp.status_code == 200, resp.text
    return resp.json()


def done_phase(phases):
    return next(p for p in phases if p["is_done"])


def setup_shared_routine(client, suf):
    """Owner cria cliente + rotina liberada + convida/aceita membro.

    Retorna (owner_auth, member_auth, cli, tmpl, shared_task).
    """
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"

    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    member_auth = get_auth_header(client, member_email, name="Membro Souza")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    tmpl = create_template(
        client, owner_auth, "Fiscal mensal", "fiscal", "once", due_days=5
    )
    create_activity(client, owner_auth, tmpl["id"], "Apurar imposto", due_days=5)
    assign_template(client, owner_auth, cli["id"], tmpl["id"])

    # Owner convida membro liberando a rotina Fiscal
    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": [tmpl["id"]]},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text

    # Membro aceita
    raw = get_raw_token_for_invite(cli["id"], member_email, [tmpl["id"]])
    acc = client.get(f"/invitations/accept?token={raw}", headers=member_auth)
    assert acc.status_code == 200, acc.text

    # Garante as 3 fases globais
    get_phases(client, member_auth)

    # Task compartilhada (do owner) da rotina liberada
    tasks = client.get(f"/tasks/?client_id={cli['id']}", headers=member_auth)
    assert tasks.status_code == 200
    shared_task = next(t for t in tasks.json() if t["template_id"] == tmpl["id"])
    return owner_auth, member_auth, cli, tmpl, shared_task


def test_member_moves_shared_task_to_done(client):
    suf = uuid4().hex[:8]
    _, member_auth, _, _, shared_task = setup_shared_routine(client, suf)

    member_phases = get_phases(client, member_auth)
    member_done = done_phase(member_phases)

    assert str(shared_task["phase_id"]) != str(member_done["id"]), (
        "Task deveria começar fora da fase concluído"
    )

    resp = client.put(
        f"/tasks/{shared_task['id']}",
        json={"phase_id": member_done["id"]},
        headers=member_auth,
    )
    assert resp.status_code == 200, resp.text
    moved = resp.json()

    # Fases globais → mesmo id, sem mapeamento; completed_at definido
    assert str(moved["phase_id"]) == str(member_done["id"])
    assert moved["completed_at"] is not None


def test_member_move_to_unknown_phase_returns_422(client):
    suf = uuid4().hex[:8]
    _, member_auth, _, _, shared_task = setup_shared_routine(client, suf)

    resp = client.put(
        f"/tasks/{shared_task['id']}",
        json={"phase_id": "00000000-0000-0000-0000-000000000000"},
        headers=member_auth,
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["error"] == "fase_inexistente"


def test_member_moves_to_em_andamento_clears_completed(client):
    suf = uuid4().hex[:8]
    _, member_auth, _, _, shared_task = setup_shared_routine(client, suf)

    phases = get_phases(client, member_auth)
    member_done = done_phase(phases)
    member_in_progress = next(p for p in phases if p["name"].lower() == "em andamento")

    # Primeiro conclui, depois volta para em andamento
    client.put(
        f"/tasks/{shared_task['id']}",
        json={"phase_id": member_done["id"]},
        headers=member_auth,
    )
    resp = client.put(
        f"/tasks/{shared_task['id']}",
        json={"phase_id": member_in_progress["id"]},
        headers=member_auth,
    )
    assert resp.status_code == 200, resp.text
    moved = resp.json()
    assert str(moved["phase_id"]) == str(member_in_progress["id"])
    assert moved["completed_at"] is None


def test_member_cannot_move_task_of_ungranted_routine(client):
    suf = uuid4().hex[:8]
    owner_auth, member_auth, cli, _, _ = setup_shared_routine(client, suf)

    # Owner cria rotina NÃO liberada e a vincula ao cliente
    tmpl_secret = create_template(
        client, owner_auth, "Confidencial", "contabil", "once", due_days=3
    )
    create_activity(
        client, owner_auth, tmpl_secret["id"], "Relatorio interno", due_days=3
    )
    assign_template(client, owner_auth, cli["id"], tmpl_secret["id"])

    tasks_owner = client.get(f"/tasks/?client_id={cli['id']}", headers=owner_auth)
    secret_task = next(
        t for t in tasks_owner.json() if t["template_id"] == tmpl_secret["id"]
    )

    member_done = done_phase(get_phases(client, member_auth))
    resp = client.put(
        f"/tasks/{secret_task['id']}",
        json={"phase_id": member_done["id"]},
        headers=member_auth,
    )
    assert resp.status_code == 404, resp.text


def test_owner_moves_own_task_normally(client):
    suf = uuid4().hex[:8]
    owner_auth = get_auth_header(client, f"owner_{suf}@cafe.com", name="Owner Silva")
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    tmpl = create_template(
        client, owner_auth, "Fiscal mensal", "fiscal", "once", due_days=5
    )
    create_activity(client, owner_auth, tmpl["id"], "Apurar imposto", due_days=5)
    assign_template(client, owner_auth, cli["id"], tmpl["id"])

    owner_phases = get_phases(client, owner_auth)
    owner_done = done_phase(owner_phases)

    tasks = client.get(f"/tasks/?client_id={cli['id']}", headers=owner_auth)
    task = next(t for t in tasks.json() if t["template_id"] == tmpl["id"])

    resp = client.put(
        f"/tasks/{task['id']}",
        json={"phase_id": owner_done["id"]},
        headers=owner_auth,
    )
    assert resp.status_code == 200, resp.text
    moved = resp.json()
    assert str(moved["phase_id"]) == str(owner_done["id"])
    assert moved["completed_at"] is not None
