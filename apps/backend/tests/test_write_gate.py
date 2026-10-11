"""Write gate by route — §4 of the payments plan (Fase 6).

Every mutating route must be classified in `classify_route`, and a free user may
only mutate the three modules of §2. The completeness test is the one that
keeps a new route from silently opening a hole: any endpoint added without a
rule fails the suite before it ships.

The gate runs as an app-level dependency (before any route handler), so the
403 answers are decided here and route auth still answers 401 on its own.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.core.entitlements import (
    MODULE_CAPTAR,
    MODULE_GESTAO,
    MODULE_PLATAFORMA,
    WRITE_FORBIDDEN_DETAIL,
    classify_route,
    write_gate,
)
from src.core.security import PasswordService
from src.main import create_app
from src.modules.auth.repository import UserRepository
from src.modules.subscriptions.models import (
    SUBSCRIPTION_CYCLE_MONTHLY,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BetaAccess,
    Plan,
    Subscription,
)
from tests.helpers import TEST_PASSWORD, unique_email

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _seed_user(db_session, *, role: str = "user"):
    """Creates a user directly in the test session (savepoint-safe).

    The insert is committed inside the same test session, the way
    `test_entitlements` commits its seeds. Leaving it uncommitted is what makes
    the app's login request roll it back on the shared StaticPool connection
    and then the savepoint fails at teardown (P-19).

    Args:
        db_session: Test database session.
        role: Role of the new user.

    Returns:
        The persisted user.
    """
    user = UserRepository(db_session).create_user(
        email=unique_email("gate"),
        password_hash=PasswordService.hash_password(TEST_PASSWORD),
        name="Gate Test",
        role=role,
        terms_accepted=True,
    )
    db_session.commit()
    return user


def _login(client, user) -> dict:
    """Logs a seeded user in through the real endpoint.

    Args:
        client: Test client.
        user: The user to authenticate.

    Returns:
        The Authorization header.
    """
    response = client.post(
        "/auth/login",
        data={"username": user.email, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _seed_subscription(db_session, user_id, *, days: int, status: str) -> None:
    """Seeds a plan and a subscription granting access for `days` more days.

    Args:
        db_session: Test database session.
        user_id: Owner of the subscription.
        days: How long the access lasts from now.
        status: Subscription status (`active` or `past_due`).
    """
    now = datetime.now(UTC)
    plan = Plan(
        id=uuid4(),
        code="monthly",
        name="Mensal",
        price="27.90",
        cycle=SUBSCRIPTION_CYCLE_MONTHLY,
        is_active=True,
    )
    db_session.add(plan)
    db_session.add(
        Subscription(
            id=uuid4(),
            user_id=user_id,
            plan_id=plan.id,
            status=status,
            cycle=SUBSCRIPTION_CYCLE_MONTHLY,
            price="27.90",
            current_period_start=now - timedelta(days=20),
            current_period_end=now + timedelta(days=days),
            grace_until=now + timedelta(days=days)
            if status != SUBSCRIPTION_STATUS_ACTIVE
            else None,
            asaas_subscription_id=f"sub_{uuid4().hex[:8]}",
            price_sync_status="synced",
        )
    )
    db_session.commit()


def _seed_beta(db_session, user_id, *, days: int) -> None:
    """Seeds a beta grant expiring in `days` days.

    Args:
        db_session: Test database session.
        user_id: Owner of the grant.
        days: How long the grant lasts from now.
    """
    db_session.add(
        BetaAccess(
            id=uuid4(),
            user_id=user_id,
            expires_at=datetime.now(UTC) + timedelta(days=days),
            source="launch_beta",
        )
    )
    db_session.commit()


def _blocked(response) -> bool:
    """Whether the response is the gate's own 403.

    Args:
        response: Test client response.

    Returns:
        True only for the gate's refusal, not for a route 403.
    """
    return (
        response.status_code == 403
        and response.json().get("detail") == WRITE_FORBIDDEN_DETAIL
    )


def test_every_mutating_route_is_classified() -> None:
    """A new mutating route without a §4 rule must fail the suite."""
    app = create_app()
    unclassified = [
        f"{method.upper()} {path}"
        for path, methods in app.openapi()["paths"].items()
        for method in methods
        if method.upper() not in SAFE_METHODS and classify_route(path) is None
    ]
    assert unclassified == []


def test_unknown_path_is_not_classified() -> None:
    """A path outside every §4 row returns `None` (fail closed at the gate)."""
    assert classify_route("/rota-que-nao-existe") is None


def test_unclassified_mutation_fails_closed() -> None:
    """The gate denies an unclassified mutation even without a token."""
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/rota-que-nao-existe",
            "headers": [],
            "query_string": b"",
            "client": ("testclient", 50000),
            "scheme": "http",
            "server": ("testclient", 80),
        }
    )
    with pytest.raises(HTTPException) as exc_info:
        write_gate(request, None, None)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == WRITE_FORBIDDEN_DETAIL


def test_profile_comments_belong_to_gestao() -> None:
    """Profile comments are the member family, not the forum (§4 endpoint map)."""
    rule = classify_route("/network/profile-comments/some-comment-id")
    assert rule is not None
    assert rule.module == MODULE_GESTAO
    assert not rule.free_writable


def test_public_share_decision_is_free_writable() -> None:
    """A public share-link decision is authorized by the hash, not the plan.

    Blocking a logged-in free user here while an anonymous visitor succeeds
    would make the shared proposal impossible to answer; the possession of
    `share_hash` is the authorization.
    """
    rule = classify_route("/proposals/public/hash/decision")
    assert rule is not None
    assert rule.module == MODULE_CAPTAR
    assert rule.free_writable


def test_asaas_webhook_is_never_gated() -> None:
    """The payment webhook is signature-authenticated and always passes §4."""
    rule = classify_route("/payments/webhook")
    assert rule is not None
    assert rule.always_allowed
    assert rule.module == MODULE_PLATAFORMA


def test_free_user_cannot_mutate_a_read_only_module(client, db_session) -> None:
    """§2: gestão and captar are read-only for a free user."""
    user = _seed_user(db_session)
    headers = _login(client, user)
    for path in ("/contacts/", "/prospects/", "/proposals/"):
        response = client.post(path, json={}, headers=headers)
        assert _blocked(response), f"{path} -> {response.status_code} {response.text}"


def test_free_user_can_mutate_the_writable_modules(client, db_session) -> None:
    """§2: a free user may write operacional, comunidade and pagamentos."""
    user = _seed_user(db_session)
    headers = _login(client, user)
    response = client.post(
        "/network/me/skills", json={"name": "Python"}, headers=headers
    )
    assert response.status_code == 201 and not _blocked(response), response.text
    for path in ("/tasks/", "/subscriptions/checkout"):
        response = client.post(path, json={}, headers=headers)
        assert not _blocked(response), (
            f"{path} -> {response.status_code} {response.text}"
        )


def test_free_user_can_read_every_module(client, db_session) -> None:
    """Reads are never gated; the route auth still guards them."""
    user = _seed_user(db_session)
    headers = _login(client, user)
    response = client.get("/contacts/", headers=headers)
    assert response.status_code == 200, response.text


def test_mutation_without_token_falls_through_to_route_auth(client, db_session) -> None:
    """A tokenless mutation reaches the route, which answers 401 itself."""
    response = client.post("/contacts/", json={})
    assert response.status_code == 401
    assert not _blocked(response)


def test_asaas_webhook_reaches_the_handler_without_token(client) -> None:
    """A bad webhook call is answered by the handler, not by the gate."""
    response = client.post("/payments/webhook", json={})
    assert response.status_code == 401
    assert response.json().get("detail") == "Não autorizado"


def test_free_user_can_accept_an_invitation(client, db_session) -> None:
    """§4 exception: accepting or declining an invitation stays free."""
    user = _seed_user(db_session)
    headers = _login(client, user)
    for action in ("accept", "decline"):
        response = client.post(
            f"/invitations/{uuid4()}/" + action, json={}, headers=headers
        )
        assert not _blocked(response), f"{action} -> {response.status_code}"


def test_paid_user_can_mutate_a_read_only_module(client, db_session) -> None:
    """An active subscription unlocks every module (§2)."""
    user = _seed_user(db_session)
    _seed_subscription(db_session, user.id, days=30, status=SUBSCRIPTION_STATUS_ACTIVE)
    headers = _login(client, user)
    response = client.post("/contacts/", json={}, headers=headers)
    assert not _blocked(response), response.text


def test_past_due_user_inside_grace_can_mutate_read_only(client, db_session) -> None:
    """§17.4: the dunning tolerance keeps access during the grace window."""
    user = _seed_user(db_session)
    _seed_subscription(db_session, user.id, days=2, status=SUBSCRIPTION_STATUS_PAST_DUE)
    headers = _login(client, user)
    response = client.post("/contacts/", json={}, headers=headers)
    assert not _blocked(response), response.text


def test_beta_user_can_mutate_a_read_only_module(client, db_session) -> None:
    """§17.3: a running beta grant unlocks every module."""
    user = _seed_user(db_session)
    _seed_beta(db_session, user.id, days=30)
    headers = _login(client, user)
    response = client.post("/contacts/", json={}, headers=headers)
    assert not _blocked(response), response.text


def test_admin_can_mutate_a_read_only_module(client, db_session) -> None:
    """An admin is never gated."""
    user = _seed_user(db_session, role="admin")
    headers = _login(client, user)
    response = client.post("/contacts/", json={}, headers=headers)
    assert not _blocked(response), response.text
