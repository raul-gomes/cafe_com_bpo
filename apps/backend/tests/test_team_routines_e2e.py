"""
E2E completo: rotinas + times (Modelo A).

Cenário:
1. Owner cria cliente e sua própria rotina (template) "Fiscal mensal".
2. Owner vincula a rotina ao cliente → tasks do OWNER são geradas.
3. Owner convida um membro, liberando a rotina "Fiscal".
4. Membro aceita o convite (token obtido do canal do email, via repositório).
5. Membro cria a SUA PRÓPRIA rotina "Atendimento" para o mesmo cliente →
   tasks do MEMBRO são geradas.
6. Validações de visibilidade/segurança:
   - Owner vê TODAS as tasks do cliente (as dele + as do membro).
   - Membro vê as tasks PRÓPRIAS + as das rotinas liberadas no convite.
   - Membro NÃO vê tasks de rotinas do owner que não foram liberadas.
   - assignee_name presente quando a task é de outra pessoa.
   - Role/is_active do membro corretos no time.
7. Validações de convite:
   - Novo convite duplicado para membro já aceito → erro.
   - Convite para membro pendente → erro de pendência.
   - Membro (não owner) não pode remover outros membros.
8. Owner remove o membro → membro deixa de ver o time.
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


def create_activity(client, auth, template_id, name, due_day=None, due_days=None):
    payload = {"name": name}
    if due_day is not None:
        payload["due_day"] = due_day
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
    """Recupera o raw token de um convite pendente (simula o canal do email).

    O token não é armazenado (apenas o hash; o raw vai por email), então criamos
    um convite equivalente no repositório para obter o raw token com as mesmas
    rotinas liberadas do convite feito via API.
    """
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


def test_owner_routines_and_invited_member_routines(client):
    suf = uuid4().hex[:8]
    owner_email = f"owner_{suf}@cafe.com"
    member_email = f"member_{suf}@cafe.com"
    third_email = f"other_{suf}@cafe.com"

    # 1) Owner registra e cria cliente
    owner_auth = get_auth_header(client, owner_email, name="Owner Silva")
    owner_me = client.get("/auth/me", headers=owner_auth)
    owner_user_id = owner_me.json()["id"]
    cli = create_client(client, owner_auth, name=f"Cliente {suf}")

    # 2) Owner cria rotina "Fiscal" (com atividade) e vincula ao cliente
    tmpl_fiscal = create_template(
        client, owner_auth, "Fiscal mensal", "fiscal", "once", due_days=5
    )
    create_activity(client, owner_auth, tmpl_fiscal["id"], "Apurar imposto", due_days=5)
    assign_template(client, owner_auth, cli["id"], tmpl_fiscal["id"])

    # 3) Owner cria rotina "Confidencial" (NÃO será liberada ao membro) e vincula
    tmpl_confidencial = create_template(
        client, owner_auth, "Confidencial", "contabil", "once", due_days=3
    )
    create_activity(
        client, owner_auth, tmpl_confidencial["id"], "Relatorio interno", due_days=3
    )
    assign_template(client, owner_auth, cli["id"], tmpl_confidencial["id"])

    # Owner vê suas tasks do cliente (fiscal + confidencial)
    tasks_owner = client.get(f"/tasks/?client_id={cli['id']}", headers=owner_auth)
    assert tasks_owner.status_code == 200
    owner_task_ids = {t["id"] for t in tasks_owner.json()}
    assert len(owner_task_ids) >= 2, "Owner deveria ter tasks das duas rotinas"
    owner_fiscal_task = next(
        t for t in tasks_owner.json() if t["template_id"] == tmpl_fiscal["id"]
    )

    # A API sempre retorna assignee_name (nome do dono da task).
    # A lógica de NÃO exibir para o próprio usuário é do frontend (user_id === currentUser).
    assert owner_fiscal_task["assignee_name"] == "Owner Silva"

    # 4) Membro registra
    member_auth = get_auth_header(client, member_email, name="Membro Souza")

    # 5) Owner convida membro liberando APENAS a rotina "Fiscal"
    inv = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": [tmpl_fiscal["id"]]},
        headers=owner_auth,
    )
    assert inv.status_code == 201, inv.text
    assert inv.json()["total_sent"] == 1

    # Membro ainda não aceitou → listar team do cliente dá 403
    assert (
        client.get(f"/clients/{cli['id']}/team", headers=member_auth).status_code == 403
    )

    # 6) Membro aceita o convite (token via email).
    # O convite via API ficou `pending`; o aceite usa um convite equivalente
    # criado no repositório (simulando o link que o email carregaria).
    raw_token = get_raw_token_for_invite(cli["id"], member_email, [tmpl_fiscal["id"]])
    acc = client.get(f"/invitations/accept?token={raw_token}", headers=member_auth)
    assert acc.status_code == 200, acc.text
    assert acc.json()["status"] == "accepted"
    assert acc.json()["client_id"] == cli["id"]

    # Team agora inclui o membro com role 'member' e is_active True
    team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth)
    assert team.status_code == 200
    members = {m["email"]: m for m in team.json()["members"]}
    assert member_email in members
    assert members[member_email]["role"] == "member"
    assert members[member_email]["is_active"] is True
    # A rotina liberada aparece para o membro
    assert any(
        r["template_id"] == tmpl_fiscal["id"] for r in members[member_email]["routines"]
    )

    # 7) Membro cria a PRÓPRIA rotina "Atendimento" para o mesmo cliente
    tmpl_atend = create_template(
        client, member_auth, "Atendimento ao cliente", "financeiro", "once", due_days=7
    )
    create_activity(
        client, member_auth, tmpl_atend["id"], "Responder e-mail", due_days=7
    )
    assign_template(client, member_auth, cli["id"], tmpl_atend["id"])

    # ── Visibilidade ──
    # Owner vê TODAS as tasks do cliente (fiscal + confidencial + atendimento)
    tasks_owner = client.get(f"/tasks/?client_id={cli['id']}", headers=owner_auth)
    assert tasks_owner.status_code == 200
    owner_visible = tasks_owner.json()
    templates_owner_sees = {t["template_id"] for t in owner_visible}
    assert tmpl_fiscal["id"] in templates_owner_sees
    assert tmpl_confidencial["id"] in templates_owner_sees
    assert tmpl_atend["id"] in templates_owner_sees, "Owner deve ver rotinas do membro"

    # A task do membro (Atendimento) aparece para o owner com assignee_name do membro
    member_task_for_owner = next(
        t for t in owner_visible if t["template_id"] == tmpl_atend["id"]
    )
    assert member_task_for_owner["assignee_name"] == "Membro Souza"
    assert member_task_for_owner["user_id"] != owner_user_id, (
        "task do membro deve ter user_id do membro"
    )

    # Membro vê: tasks próprias (Atendimento) + rotina liberada (Fiscal)
    tasks_member = client.get(f"/tasks/?client_id={cli['id']}", headers=member_auth)
    assert tasks_member.status_code == 200
    member_visible = tasks_member.json()
    member_template_ids = {t["template_id"] for t in member_visible}
    assert tmpl_atend["id"] in member_template_ids, "Membro deve ver sua própria rotina"
    assert tmpl_fiscal["id"] in member_template_ids, "Membro deve ver rotina liberada"
    assert tmpl_confidencial["id"] not in member_template_ids, (
        "Membro NÃO deve ver rotina não liberada"
    )

    # Para o membro, a task fiscal é de outra pessoa → assignee_name do owner
    fiscal_for_member = next(
        t for t in member_visible if t["template_id"] == tmpl_fiscal["id"]
    )
    assert fiscal_for_member["assignee_name"] == "Owner Silva"
    assert fiscal_for_member["user_id"] == owner_user_id

    # A task própria do membro → assignee_name é o próprio nome (frontend esconde quando user_id === currentUser)
    atend_for_member = next(
        t for t in member_visible if t["template_id"] == tmpl_atend["id"]
    )
    assert atend_for_member["assignee_name"] == "Membro Souza"

    # ── Validações de convite ──
    # 1) Enquanto há convite pendente → bloquear com "convite pendente"
    dup_pending = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": [tmpl_fiscal["id"]]},
        headers=owner_auth,
    )
    assert dup_pending.status_code == 201
    assert dup_pending.json()["results"][0]["status"] == "error"
    assert "pendente" in dup_pending.json()["results"][0]["error"]

    # 2) Resolve o convite API pendente (declinado no banco) e, sem pendência,
    #    um novo convite para membro já aceito → "já é membro".
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(cli["id"]))
        inv_api = repo.get_pending_invitation_by_email(team.id, member_email)
        repo.decline_invitation(inv_api)
    finally:
        session.close()

    dup_member = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [member_email], "template_ids": [tmpl_fiscal["id"]]},
        headers=owner_auth,
    )
    assert dup_member.status_code == 201
    dup_result = dup_member.json()["results"][0]
    assert dup_result["status"] == "error"
    assert "já é membro" in dup_result["error"]

    # 3) Convite para terceiro (email que não é membro) → enviado
    inv3 = client.post(
        f"/clients/{cli['id']}/invite",
        json={"emails": [third_email], "template_ids": []},
        headers=owner_auth,
    )
    assert inv3.status_code == 201
    assert inv3.json()["total_sent"] == 1

    # ── Segurança: membro não pode remover outros membros ──
    third_auth = get_auth_header(client, third_email, name="Terceiro User")
    raw3 = get_raw_token_for_invite(cli["id"], third_email)
    acc3 = client.get(f"/invitations/accept?token={raw3}", headers=third_auth)
    assert acc3.status_code == 200

    team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth)
    third_member = next(m for m in team.json()["members"] if m["email"] == third_email)
    third_user_id = third_member["user_id"]

    # Membro (não owner) tenta remover o terceiro → 403
    rem = client.delete(
        f"/clients/{cli['id']}/team/{third_user_id}", headers=member_auth
    )
    assert rem.status_code == 403, rem.text

    # Owner remove o terceiro → 204
    rem = client.delete(
        f"/clients/{cli['id']}/team/{third_user_id}", headers=owner_auth
    )
    assert rem.status_code == 204, rem.text

    team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth)
    assert third_email not in {m["email"] for m in team.json()["members"]}

    # ── Owner remove o membro principal → deixa de ver o time ──
    member_user_id = members[member_email]["user_id"]
    rem = client.delete(
        f"/clients/{cli['id']}/team/{member_user_id}", headers=owner_auth
    )
    assert rem.status_code == 204, rem.text

    team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth)
    assert member_email not in {m["email"] for m in team.json()["members"]}
