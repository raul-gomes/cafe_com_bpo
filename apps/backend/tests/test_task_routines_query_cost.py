"""Custo de consulta das rotinas liberadas a um membro (Fase 3, item 6).

`TeamRepository.get_routines_for_member` é chamada pelo `task_manager` — no
roteiro de filtros de tarefa, nas permissões e no evento SSE. A implementação
anterior carregava a tabela `client_template_assignments` **inteira** em memória
para filtrar em Python. Essa tabela é 1:N por empresa: uma empresa com 500
rotinas faz toda chamada pagar 500 linhas lidas para descobrir que só duas são
delas, e o filtro acontecia no cliente, não no banco.

O teste mede **linhas materializadas**, e não statements: corrigir a consulta
para o banco não muda o número de statements (continua sendo um), só o volume
que ele devolve. É o volume que cresce com o tamanho das outras empresas.
"""

from datetime import datetime, timezone
from uuid import UUID

import pytest
from sqlalchemy import event, func, select

from src.core.database import SessionLocal
from src.modules.task_manager.models import (
    ActivityTemplate,
    ClientTemplateAssignment,
)
from src.modules.team.models import TeamMember
from src.modules.team.repository import TeamRepository
from tests.helpers import register_user
from tests.test_team_invitations import create_client, get_auth_header

# Teto de linhas lidas por chamada para a tabela de vínculos. A empresa do teste
# tem 2; a rival tem 40. A implementação antiga lia 42 para responder sobre 2.
MAX_ASSIGNMENT_ROWS = 10


@pytest.fixture
def rows_materialized():
    """Conta quantas linhas de `client_template_assignments` viram objeto ORM.

    O evento `load` do mapper dispara uma vez por instância materializada — é
    a medida do custo real (o volume trazido do banco), e não do número de
    statements, que é o mesmo antes e depois da correção.
    """
    totals = {"assignments": 0}

    def on_load(state, _context):
        totals["assignments"] += 1

    event.listen(ClientTemplateAssignment, "load", on_load)
    try:
        yield totals
    finally:
        event.remove(ClientTemplateAssignment, "load", on_load)
        SessionLocal().close()


def _user_by_email(email: str):
    """Busca o usuário já registrado — `get_auth_header` cria a conta."""
    session = SessionLocal()
    try:
        found = TeamRepository(session).get_user_by_email(email)
        assert found is not None, f"usuário {email} não registrado"
        return found
    finally:
        session.close()


def _create_templates(user_id: UUID, count: int, prefix: str) -> list[str]:
    """Cria `count` rotinas de atividade do dono e devolve os ids."""
    session = SessionLocal()
    try:
        ids = []
        for index in range(count):
            template = ActivityTemplate(
                name=f"{prefix} {index}", description="x", user_id=user_id
            )
            session.add(template)
            session.flush()
            ids.append(str(template.id))
        session.commit()
        return ids
    finally:
        session.close()


def _link(client_id: str, template_id: str, user_id: UUID, is_active: bool) -> None:
    """Vincula a rotina a uma empresa pelo caminho legado (`client_id`)."""
    session = SessionLocal()
    try:
        session.add(
            ClientTemplateAssignment(
                client_id=UUID(client_id),
                template_id=UUID(template_id),
                user_id=user_id,
                is_active=is_active,
            )
        )
        session.commit()
    finally:
        session.close()


def _make_member_with_routines(
    client,
    client_id: str,
    auth: dict,
    member_email: str,
    template_ids: list[str],
) -> UUID:
    """Convida a pessoa, aceita o convite e promove a membro ativo.

    O aceite real exigiria um token por pessoa; o que o repositório lê são as duas
    linhas que o aceite grava — o convite com status `accepted` (é por ele que as
    rotinas do membro são resolvidas) e a linha de membro.
    """
    register_user({"email": member_email})
    response = client.post(
        f"/clients/{client_id}/invite",
        json={"emails": [member_email], "template_ids": template_ids},
        headers=auth,
    )
    assert response.status_code == 201, response.text

    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(client_id))
        invitation = repo.get_pending_invitation_by_email(team.id, member_email)
        assert invitation is not None, f"convite pendente de {member_email} não existe"
        invitation.status = "accepted"
        invitation.accepted_at = datetime(2026, 9, 15, 12, tzinfo=timezone.utc)
        session.add(invitation)
        member = TeamMember(
            team_id=team.id,
            user_id=repo.get_user_by_email(member_email).id,
            role_id=repo.get_role_by_name("member").id,
            is_active=True,
        )
        session.add(member)
        session.commit()
        return member.user_id
    finally:
        session.close()


def test_routines_of_member_do_not_read_other_companies_assignments(
    client, rows_materialized
):
    """A chamada filtra os vínculos no banco, sem varrer a tabela inteira.

    A empresa do membro tem 2 vínculos; uma empresa rival tem 40. Responder
    sobre 2 não pode custar 42 linhas lidas — o que era exatamente o custo antes.
    """
    auth = get_auth_header(client, "dono-rotinas@cafe.com")
    owner = _user_by_email("dono-rotinas@cafe.com")
    company = create_client(client, auth, "Empresa Das Rotinas")
    client_id = company["id"]

    owned = _create_templates(owner.id, 2, "Dela")
    for template_id in owned:
        _link(client_id, template_id, owner.id, is_active=True)

    rival_auth = get_auth_header(client, "dono-rival@cafe.com")
    rival_owner = _user_by_email("dono-rival@cafe.com")
    rival = create_client(client, rival_auth, "Empresa Rival")
    for template_id in _create_templates(rival_owner.id, 40, "Rival"):
        _link(rival["id"], template_id, rival_owner.id, is_active=True)

    member_id = _make_member_with_routines(
        client, client_id, auth, "membro-rotinas@cafe.com", [owned[0]]
    )

    with SessionLocal() as session:
        total = session.execute(
            select(func.count()).select_from(ClientTemplateAssignment)
        ).scalar()
    assert total == 42, "as duas empresas precisam somar 42 vínculos para o teste valer"

    with SessionLocal() as session:
        repo = TeamRepository(session)
        rows_materialized["assignments"] = 0
        routines = repo.get_routines_for_member(UUID(client_id), member_id)
        read = rows_materialized["assignments"]

    assert [routine.id for routine in routines] == [UUID(owned[0])]
    assert read <= MAX_ASSIGNMENT_ROWS, (
        f"a chamada leu {read} linhas de client_template_assignments; "
        f"o teto é {MAX_ASSIGNMENT_ROWS} — o filtro precisa acontecer no banco"
    )


def test_inactive_assignment_is_still_excluded(client):
    """Vínculo desativado não libera a rotina, e vínculo ausente libera.

    Regressão de comportamento junto com a mudança de consulta: o filtro passa a
    vir do banco, e tanto "desativado esconde" quanto "sem vínculo libera"
    precisam continuar valendo.
    """
    auth = get_auth_header(client, "dono-vinculo@cafe.com")
    owner = _user_by_email("dono-vinculo@cafe.com")
    company = create_client(client, auth, "Empresa Do Vinculo")
    client_id = company["id"]

    active = _create_templates(owner.id, 1, "Ativa")[0]
    inactive = _create_templates(owner.id, 1, "Inativa")[0]
    granted_without_link = _create_templates(owner.id, 1, "Sem Vinculo")[0]

    _link(client_id, active, owner.id, is_active=True)
    _link(client_id, inactive, owner.id, is_active=False)

    member_id = _make_member_with_routines(
        client,
        client_id,
        auth,
        "membro-vinculo@cafe.com",
        [active, inactive, granted_without_link],
    )

    with SessionLocal() as session:
        repo = TeamRepository(session)
        routines = repo.get_routines_for_member(UUID(client_id), member_id)

    assert sorted(routine.id for routine in routines) == sorted(
        [UUID(active), UUID(granted_without_link)]
    ), (
        "a rotina com vínculo desativado tem de ficar de fora; "
        "a rotina sem vínculo nenhum continua liberada"
    )
