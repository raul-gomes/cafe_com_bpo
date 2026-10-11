"""Contrato de payload e custo de consulta do módulo de equipe (Fase 3, item 5).

Cenários:
1. `GET /clients/{id}/team` responde só os campos que o card de membro renderiza.
2. `GET /clients/{id}/invitations` responde só os campos que o card de convite
   renderiza — o nome das rotinas é montado e nunca enviado (regra §6).
3. O mesmo contrato vale na resposta de `POST .../resend`.
4. A listagem da equipe custa um número constante de queries, não uma por
   membro (o N+1 do serviço: usuário + role + rotinas por linha).
5. A listagem de convites custa um número constante de queries, não duas por
   rotina (o serviço chamava `get_template_by_id` duas vezes por rotina).
6. A equipe e a listagem de convites saem da empresa (`companies`), não da
   tabela legada `clients`: degradar a linha `clients` some com o time.
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event

from src.core.database import SessionLocal
from src.modules.clients.models import Client
from src.modules.task_manager.models import ActivityTemplate, ClientTemplateAssignment
from src.modules.team.models import Team, TeamMember
from src.modules.team.repository import TeamRepository
from tests.helpers import register_user
from tests.test_team_invitations import create_client, get_auth_header

# Campos que o card de membro renderiza: avatar (name/email), nome, e-mail e os
# chips de rotina (`template_id` + `name`).
TEAM_MEMBER_KEYS = {"user_id", "name", "email", "routines"}
# Campos que o card de convite renderiza: identidade, status e as datas.
INVITATION_KEYS = {"invitation_id", "email", "status", "expires_at", "accepted_at"}


@pytest.fixture
def query_counter():
    """Conta as queries SQL de um bloco, para provar que não há N+1."""
    counter = {"count": 0}

    def track(conn, cursor, statement, parameters, context, executemany):
        counter["count"] += 1

    engine = SessionLocal().get_bind()
    event.listen(engine, "before_cursor_execute", track)
    try:
        yield counter
    finally:
        event.remove(engine, "before_cursor_execute", track)
        SessionLocal().close()


def _create_template(name: str, user_id: UUID) -> str:
    """Cria uma rotina de atividade do dono e devolve o id."""
    session = SessionLocal()
    try:
        template = ActivityTemplate(name=name, description=name, user_id=user_id)
        session.add(template)
        session.commit()
        return str(template.id)
    finally:
        session.close()


def _link_template(client_id: str, template_id: str, user_id: UUID) -> None:
    """Vincula a rotina ao cliente pelo caminho do legado (`client_id`)."""
    session = SessionLocal()
    try:
        session.add(
            ClientTemplateAssignment(
                client_id=UUID(client_id),
                template_id=UUID(template_id),
                user_id=user_id,
                is_active=True,
            )
        )
        session.commit()
    finally:
        session.close()


def _invite(
    client, client_id: str, auth: dict, emails: list[str], template_ids: list[str]
):
    """Envia convites e cobra o 201 do endpoint."""
    response = client.post(
        f"/clients/{client_id}/invite",
        json={"emails": emails, "template_ids": template_ids},
        headers=auth,
    )
    assert response.status_code == 201, response.text
    return response


def _pending_invitation_id(client_id: str, email: str) -> str:
    """Id do convite pendente do e-mail, lido direto do banco."""
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(client_id))
        invitation = repo.get_pending_invitation_by_email(team.id, email)
        assert invitation is not None, f"convite pendente de {email} não encontrado"
        return str(invitation.id)
    finally:
        session.close()


def _accept_all(client_id: UUID, emails: list[str]) -> None:
    """Vira os convidados em membros ativos do time, com o convite aceito.

    O aceite pelo endpoint exigiria um token por pessoa; o que o serviço lê são
    as duas linhas que o aceite real grava — `team_members` e o convite com
    status `accepted` (é por ela que as rotinas do membro são resolvidas). Ambas
    são criadas aqui, com o usuário real de cada e-mail, para a montagem em lote
    ter o que resolver.
    """
    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(client_id)
        member_role = repo.get_role_by_name("member")
        for email in emails:
            user = repo.get_user_by_email(email)
            assert user is not None, f"usuário {email} não registrado"
            invitation = repo.get_pending_invitation_by_email(team.id, email)
            assert invitation is not None, f"convite pendente de {email} não encontrado"
            invitation.status = "accepted"
            invitation.accepted_at = datetime(2026, 9, 15, 12, tzinfo=timezone.utc)
            session.add(
                TeamMember(
                    team_id=team.id,
                    user_id=user.id,
                    role_id=member_role.id,
                    is_active=True,
                )
            )
        session.commit()
    finally:
        session.close()


def _build_team(client, suffix: str, member_count: int):
    """Cria a empresa, rotinas vinculadas e `member_count` membros na equipe.

    Cada membro ganha uma rotina diferente, para que a montagem das rotinas por
    linha tenha trabalho real.
    """
    owner_email = f"team_owner_{suffix}@cafe.com"
    owner_auth = get_auth_header(client, owner_email, name="Gestor")
    company = create_client(client, owner_auth, name=f"Empresa {suffix}")
    client_id = company["id"]

    session = SessionLocal()
    try:
        owner_id = TeamRepository(session).get_user_by_email(owner_email).id
    finally:
        session.close()

    template_ids = [
        _create_template(f"Rotina {suffix} {i}", owner_id)
        for i in range(max(member_count, 2))
    ]
    for template_id in template_ids:
        _link_template(client_id, template_id, owner_id)

    member_emails = [f"team_member_{suffix}_{i}@cafe.com" for i in range(member_count)]
    for email in member_emails:
        register_user(
            payload={
                "email": email,
                "password": "StrongPassword123!",
                "name": f"Membro {email}",
            }
        )
    if member_emails:
        _invite(client, client_id, owner_auth, member_emails, template_ids[:2])
        _accept_all(UUID(client_id), member_emails)

    return client_id, owner_auth, member_emails, template_ids


def test_team_list_ships_only_what_the_member_card_renders(client):
    """O card de membro lê nome, e-mail e rotinas — nada mais."""
    suffix = uuid4().hex[:8]
    client_id, owner_auth, _emails, _templates = _build_team(client, suffix, 1)

    response = client.get(f"/clients/{client_id}/team", headers=owner_auth)
    assert response.status_code == 200, response.text

    body = response.json()
    assert len(body["members"]) == 1
    assert set(body["members"][0]) == TEAM_MEMBER_KEYS
    assert set(body["members"][0]["routines"][0]) == {"template_id", "name"}


def test_invitation_list_ships_only_what_the_invitation_card_renders(client):
    """O card de convite não mostra rotinas nem data de criação (regra §6)."""
    suffix = uuid4().hex[:8]
    client_id, owner_auth, _emails, template_ids = _build_team(client, suffix, 0)

    _invite(
        client, client_id, owner_auth, [f"pendente_{suffix}@cafe.com"], template_ids[:2]
    )

    response = client.get(f"/clients/{client_id}/invitations", headers=owner_auth)
    assert response.status_code == 200, response.text

    invitations = response.json()["invitations"]
    assert len(invitations) == 1
    # O convite foi criado com duas rotinas liberadas; nenhuma delas aparece.
    assert set(invitations[0]) == INVITATION_KEYS


def test_resend_answers_the_same_contract_as_the_listing(client):
    """Reenviar devolve o mesmo DTO da listagem, sem os campos removidos."""
    suffix = uuid4().hex[:8]
    client_id, owner_auth, _emails, template_ids = _build_team(client, suffix, 0)

    invited = f"resend_{suffix}@cafe.com"
    _invite(client, client_id, owner_auth, [invited], template_ids[:1])
    invitation_id = _pending_invitation_id(client_id, invited)

    response = client.post(
        f"/clients/{client_id}/invitations/{invitation_id}/resend", headers=owner_auth
    )
    assert response.status_code == 200, response.text
    assert set(response.json()) == INVITATION_KEYS


def test_team_list_does_not_query_per_member(client, query_counter):
    """4 membros não podem custar uma consulta por linha.

    Antes: ~8 queries por membro (usuário, role, convite aceito, rotinas do
    convite, todos os assignments da tabela e os templates). O teto de 12 cobre
    o piso real do serviço novo sem o teste quebrar por um acréscimo de linha.
    """
    suffix = uuid4().hex[:8]
    client_id, owner_auth, _emails, _templates = _build_team(client, suffix, 4)

    query_counter["count"] = 0
    response = client.get(f"/clients/{client_id}/team", headers=owner_auth)
    assert response.status_code == 200, response.text
    assert len(response.json()["members"]) == 4

    assert query_counter["count"] <= 12, (
        f"listagem da equipe custou {query_counter['count']} queries para 4 membros"
    )


def test_invitation_list_does_not_query_per_routine(client, query_counter):
    """Convites não custam duas queries por rotina (o `get_template_by_id` dobrado)."""
    suffix = uuid4().hex[:8]
    client_id, owner_auth, _emails, template_ids = _build_team(client, suffix, 0)

    _invite(
        client, client_id, owner_auth, [f"lote_{suffix}@cafe.com"], template_ids[:3]
    )

    query_counter["count"] = 0
    response = client.get(f"/clients/{client_id}/invitations", headers=owner_auth)
    assert response.status_code == 200, response.text
    assert len(response.json()["invitations"]) == 1

    assert query_counter["count"] <= 6, (
        f"listagem de convites custou {query_counter['count']} queries para 1 convite"
    )


def test_team_is_read_from_the_company_not_the_legacy_client_row(client):
    """A equipe sobrevive à degradação da linha legada `clients`.

    A empresa é a fonte única do vínculo: se a leitura ainda exigisse a linha
    `clients`, o time sumiria junto com ela — e um cliente convertido continua
    tendo time, porque a conversão muda o `type` da própria empresa.
    """
    suffix = uuid4().hex[:8]
    client_id, owner_auth, member_emails, _templates = _build_team(client, suffix, 2)

    session = SessionLocal()
    try:
        team = session.query(Team).filter(Team.client_id == UUID(client_id)).one()
        assert team.company_id is not None, "o time deveria estar ligado à empresa"
        client_row = session.get(Client, team.client_id)
        client_row.is_active = False
        session.commit()
    finally:
        session.close()

    response = client.get(f"/clients/{client_id}/team", headers=owner_auth)
    assert response.status_code == 200, response.text
    assert len(response.json()["members"]) == 2
    assert {m["email"] for m in response.json()["members"]} == set(member_emails)
