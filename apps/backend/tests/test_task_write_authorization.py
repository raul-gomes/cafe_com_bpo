"""Regressões de escrita em `tasks` — autorização no caminho de escrita.

`create_task` aceitava `client_id` de outra empresa e criava o card no board de um
terceiro (IDOR). A listagem já checava posse/membership; a criação não.

A regra é a de `docs/regras_negocio.md` §Equipes: *colaborador só vê/atua nos
clientes aos quais foi convidado*. Então vale dono-ou-membro — e o erro é 404
(não 403) para não confirmar a existência da empresa de outro.

A segunda regressão deste arquivo era a renomeação anônima de fase canônica. Com
a decisão do produto owner (2026-10-04) de remover a gestão de fases, as rotas
`POST/PUT/DELETE /tasks/phases…` e `/tasks/phases/reorder` foram **deletadas** — a
classe de falha não existe mais e a cobertura virou "a rota não existe", em
`tests/modules/test_task_phases.py` e `tests/modules/test_task_phases_canonical.py`.
"""

from uuid import uuid4

from tests.helpers import register_user


def _login(client, email: str) -> dict:
    """Registers and logs a user in, returning the auth header.

    Args:
        client: FastAPI test client.
        email: Unique email for the new user.

    Returns:
        Authorization header dict for the new user.
    """
    register_user(payload={"email": email, "password": "StrongPassword123!"})
    token = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _company(client, auth: dict, name: str) -> dict:
    """Creates a company owned by the authenticated user.

    Args:
        client: FastAPI test client.
        auth: Auth header of the owner.
        name: Company display name.

    Returns:
        The created company payload.
    """
    resp = client.post(
        "/clients/",
        json={
            "name": name,
            "cnpj": f"1{uuid4().int % 10**13:013d}",
            "color": "#4287f5",
        },
        headers=auth,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


# ── create_task: posse e membership ──────────────────────────────────────────


def test_create_task_in_own_company_is_allowed(client):
    """Sanity check: the owner can still create a card on their own board."""
    auth = _login(client, f"own_{uuid4()}@cafe.com")
    company = _company(client, auth, "Empresa do Dono")

    resp = client.post(
        "/tasks/",
        json={"title": "Conciliar", "client_id": company["id"], "priority": "low"},
        headers=auth,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["title"] == "Conciliar"


def test_create_task_in_another_company_is_rejected(client):
    """The IDOR regression: knowing a foreign `client_id` was enough to write."""
    auth_a = _login(client, f"owner_{uuid4()}@cafe.com")
    company_a = _company(client, auth_a, "Empresa da Victims")
    auth_b = _login(client, f"intruder_{uuid4()}@cafe.com")

    resp = client.post(
        "/tasks/",
        json={
            "title": "Card Invasor",
            "client_id": company_a["id"],
            "priority": "high",
        },
        headers=auth_b,
    )

    assert resp.status_code == 404, resp.text
    # The card must not exist at all, not even for the owner of the company.
    listed = client.get("/tasks/", headers=auth_a).json()
    assert not any(t["title"] == "Card Invasor" for t in listed)


def test_create_task_in_a_nonexistent_company_is_rejected(client):
    """An id that is not a company is indistinguishable from a foreign one."""
    auth = _login(client, f"ghost_{uuid4()}@cafe.com")

    resp = client.post(
        "/tasks/",
        json={"title": "Card Fantasma", "client_id": str(uuid4()), "priority": "low"},
        headers=auth,
    )

    assert resp.status_code == 404, resp.text


def test_create_task_for_a_prospect_is_rejected(client):
    """Tasks exist only for client-stage companies (composite FK guarantee)."""
    auth = _login(client, f"prospect_{uuid4()}@cafe.com")
    prospect = client.post(
        "/prospects/", json={"name": "Lead em Negociação"}, headers=auth
    ).json()

    resp = client.post(
        "/tasks/",
        json={"title": "Card em Prospect", "client_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 404, resp.text


def _accept_invitation(
    client, company_id: str, member_email: str, owner_auth: dict, member_auth: dict
) -> None:
    """Invites a member to the company team and accepts the invitation.

    Uses the real invitation flow (create + raw token fetch + accept) so the
    membership is exactly what production produces.

    Args:
        client: FastAPI test client.
        company_id: Id of the company whose team receives the invitation.
        member_email: Email of the invited user.
        owner_auth: Auth header of the company owner (the inviter).
        member_auth: Auth header of the invited user (the acceptor).
    """
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.team.repository import TeamRepository

    invited = client.post(
        f"/clients/{company_id}/invite",
        json={"emails": [member_email], "template_ids": []},
        headers=owner_auth,
    )
    assert invited.status_code == 201, invited.text

    session = SessionLocal()
    try:
        repo = TeamRepository(session)
        team = repo.get_team_by_client_id(UUID(company_id))
        pending = repo.get_pending_invitation_by_email(team.id, member_email)
        assert pending is not None, "convite pendente não encontrado"
        _, raw_token = repo.create_invitation(
            team_id=team.id,
            invited_by=pending.invited_by,
            invited_email=member_email,
            template_ids=[],
        )
    finally:
        session.close()

    accepted = client.get(f"/invitations/accept?token={raw_token}", headers=member_auth)
    assert accepted.status_code == 200, accepted.text


def test_team_member_can_create_task_in_shared_company(client):
    """Rule: a collaborator acts on the clients they were invited to.

    The write path must not be stricter than the read path, otherwise the
    invitation would be useless: the member could see the shared board and not
    create a single card on it.
    """
    owner_email = f"boss_{uuid4()}@cafe.com"
    member_email = f"collab_{uuid4()}@cafe.com"
    auth_owner = _login(client, owner_email)
    company = _company(client, auth_owner, "Empresa Compartilhada")
    auth_member = _login(client, member_email)
    _accept_invitation(client, company["id"], member_email, auth_owner, auth_member)

    resp = client.post(
        "/tasks/",
        json={
            "title": "Card do Colaborador",
            "client_id": company["id"],
            "priority": "low",
        },
        headers=auth_member,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["title"] == "Card do Colaborador"
