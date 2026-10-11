"""Cancelling a subscription — §17.5, the route the product never had (P-17).

Eight rules are protected here, and each one was a plausible silent bug:

1. **The recurrence stops at the provider first, the local row follows.**
   Cancelling only our mirror would leave Asaas charging a user who was told
   they stopped paying; the next `PAYMENT_CONFIRMED` would record money against
   a canceled row.
2. **The paid period is never shortened.** Who cancels keeps what they paid
   until `current_period_end` (§17.5) — the access assertions pin that.
3. **A provider refusal never writes locally** — 502 with our own words, row
   untouched, so a failed cancel can be retried instead of silently lying.
4. **A subscription the provider already removed (404) is still cancelled
   locally**: the recurrence is gone, refusing to mirror it would strand the
   user on a row that no longer exists over there.
5. **When our provider id is missing the lookup is best effort but not blind**
   (`GET /subscriptions?customer=`): an empty answer cancels locally, an
   *unreachable* provider fails closed with 502 — guessing here is how a user
   keeps getting charged after cancelling.
6. **Cancel is idempotent**: an already-canceled row answers 200 without a
   second provider call (the webhook of §17.5 may have raced us).
7. **An abandoned unpaid checkout is discarded**, closing its provider session
   so nobody can still pay a session the user walked away from — that is also
   what frees the one-open-subscription seat for a retry.
8. **The route never trusts a client-sent identity** (§17.7): there is no id
   in the path and no id in the body, the row comes from the session's user.

The response is a contract: `current_period_end` is the only field, because
the confirmation screen reads exactly one thing — until when the access lasts
(§6); it is `null` when there was never a paid period (a discarded checkout).
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import httpx
import pytest
from sqlalchemy.orm import Session

from src.core.config import get_settings
from src.core.entitlements import AccessState, resolve_access
from src.core.time_utils import as_utc
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.subscriptions.models import (
    PRICE_SYNC_SYNCED,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_INCOMPLETE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    Plan,
    Subscription,
)
from tests.helpers import TEST_PASSWORD, create_test_user

FIXED_NOW = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)
PERIOD_END = datetime(2026, 10, 26, 3, 0, tzinfo=UTC)

CANCEL_PATH = "/subscriptions/cancel"


def _login_as(client, email: str) -> dict:
    """Logs in as a user a test already created.

    Args:
        client: FastAPI test client.
        email: E-mail of the existing user.

    Returns:
        The authorization header.
    """
    response = client.post(
        "/auth/login", data={"username": email, "password": TEST_PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _user(db_session: Session) -> tuple[UserResponse, str]:
    """Creates a fresh user for a cancel test.

    Args:
        db_session: Database session.

    Returns:
        The user as the router sees it, and its e-mail.
    """
    email = f"cancel_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")
    row = db_session.query(User).filter(User.email == email).one()
    return UserResponse.from_user(row), email


def _seed(
    db_session: Session,
    user: UserResponse,
    plan: Plan,
    *,
    status: str,
    provider_id: str | None = None,
    checkout_id: str | None = "chk_cx_1",
    customer: str | None = "cus_cx_1",
    period_end: datetime | None = PERIOD_END,
    grace_until: datetime | None = None,
) -> Subscription:
    """Seeds a subscription row in the state a test cancels from.

    Args:
        db_session: Database session.
        user: Owner of the row.
        plan: Plan the row bills.
        status: Starting status of the row.
        provider_id: Asaas subscription id, when the enrichment succeeded.
        checkout_id: Asaas checkout session id, when one was stored.
        customer: Asaas customer id used by the lookup fallback.
        period_end: Paid-through instant, or `None` for an unpaid row.
        grace_until: Dunning window, when the row is past due.

    Returns:
        The seeded row.
    """
    row = Subscription(
        id=uuid4(),
        user_id=user.id,
        plan_id=plan.id,
        status=status,
        cycle="MONTHLY",
        price=Decimal("27.90"),
        asaas_customer_id=customer,
        asaas_checkout_id=checkout_id,
        asaas_subscription_id=provider_id,
        price_sync_status=PRICE_SYNC_SYNCED,
        current_period_start=FIXED_NOW - timedelta(days=10),
        current_period_end=period_end,
        grace_until=grace_until,
        canceled_at=FIXED_NOW - timedelta(days=1)
        if status == SUBSCRIPTION_STATUS_CANCELED
        else None,
    )
    db_session.add_all([row])
    db_session.commit()
    return row


def _stored(db_session: Session, row_id: UUID) -> Subscription | None:
    """Re-reads a row after the route wrote through its own session.

    Args:
        db_session: Database session.
        row_id: Id of the row to read.

    Returns:
        The fresh row, or `None` when it was deleted.
    """
    db_session.expunge_all()
    return db_session.get(Subscription, row_id)


@pytest.fixture
def plan(db_session: Session) -> Plan:
    """Seeds the monthly plan the tests subscribe to.

    Args:
        db_session: Database session.

    Returns:
        The active plan.
    """
    seeded = Plan(
        id=uuid4(),
        code="mensal",
        name="Cafe com BPO - Mensal",
        price=Decimal("27.90"),
        cycle="MONTHLY",
        is_active=True,
        description="Assinatura mensal",
    )
    db_session.add(seeded)
    db_session.commit()
    return seeded


@pytest.fixture
def provider(monkeypatch):
    """Serves fake Asaas answers for every call the cancel route makes.

    The transport is swapped with `httpx.MockTransport`, so `AsaasClient` runs
    exactly as in production while the test stays offline: the factory patch
    intercepts the client the route constructs, and the handler answers by verb
    and path with the status each test needs (refusal, already-gone, outage).

    Args:
        monkeypatch: Pytest monkeypatch fixture.

    Returns:
        A mutable object with the recorded `requests` and the per-path statuses.
    """

    class Provider:
        def __init__(self) -> None:
            self.requests: list[httpx.Request] = []
            self.delete_status = 200
            self.checkout_cancel_status = 200
            self.list_status = 200
            self.list_data: list[dict] = []

        def calls_to(self, method: str, suffix: str) -> list[httpx.Request]:
            """Selects the recorded requests of one verb hitting a path suffix.

            Args:
                method: HTTP verb to match.
                suffix: Path suffix, e.g. `/subscriptions/`.

            Returns:
                The matching requests, in order.
            """
            return [
                r
                for r in self.requests
                if r.method == method and r.url.path.endswith(suffix)
            ]

        @property
        def deletes(self) -> list[httpx.Request]:
            """The `DELETE /subscriptions/{id}` requests recorded so far.

            Returns:
                The matching requests, in order.
            """
            return [
                r
                for r in self.requests
                if r.method == "DELETE" and "/subscriptions/" in r.url.path
            ]

    fake = Provider()

    def handler(request: httpx.Request) -> httpx.Response:
        fake.requests.append(request)
        path = request.url.path
        if request.method == "DELETE" and "/subscriptions/" in path:
            if fake.delete_status != 200:
                return httpx.Response(fake.delete_status, json={"detail": "not found"})
            provider_id = path.rsplit("/", 1)[-1]
            return httpx.Response(200, json={"id": provider_id, "status": "REMOVED"})
        if request.method == "POST" and path.endswith("/cancel"):
            if fake.checkout_cancel_status != 200:
                return httpx.Response(
                    fake.checkout_cancel_status, json={"detail": "gone"}
                )
            return httpx.Response(200, json={"status": "CANCELED"})
        if request.method == "GET" and path.endswith("/subscriptions"):
            if fake.list_status != 200:
                return httpx.Response(fake.list_status, json={"detail": "boom"})
            return httpx.Response(200, json={"object": "list", "data": fake.list_data})
        return httpx.Response(200, json={})

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client_cls(*args, **kwargs)

    real_client_cls = httpx.AsyncClient
    monkeypatch.setenv("ASAAS_API_KEY", "asaas-api-key-for-tests")
    monkeypatch.setenv("ASAAS_BASE_URL", "https://api.asaas.com/api/v3")
    monkeypatch.setenv("MODE", "test")
    get_settings.cache_clear()
    monkeypatch.setattr(httpx, "AsyncClient", factory)
    try:
        yield fake
    finally:
        get_settings.cache_clear()


def _cancel(client, email: str):
    """Posts to the cancel route as an authenticated user.

    Args:
        client: FastAPI test client.
        email: E-mail of the logged-in user.

    Returns:
        The response.
    """
    return client.post(CANCEL_PATH, headers=_login_as(client, email))


# ── paid subscriptions ───────────────────────────────────────────────────────


def test_cancel_stops_the_recurrence_and_keeps_the_paid_period(
    provider, client, db_session: Session, plan: Plan
):
    """§17.5: the provider stops charging and the month already paid stays.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id="sub_paid_1",
    )

    response = _cancel(client, email)

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"current_period_end"}
    assert datetime.fromisoformat(body["current_period_end"]) == PERIOD_END

    deletes = provider.deletes
    assert len(deletes) == 1
    assert deletes[0].url.path.endswith("/subscriptions/sub_paid_1")

    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_CANCELED
    assert fresh.canceled_at is not None
    assert fresh.grace_until is None
    assert fresh.current_period_end is not None
    assert as_utc(fresh.current_period_end) == PERIOD_END


def test_cancel_keeps_full_access_until_the_paid_period_ends(
    provider, client, db_session: Session, plan: Plan
):
    """Quem pagou o mês não perde o mês: canceled still unlocks until the end.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id="sub_paid_2",
    )
    assert _cancel(client, email).status_code == 200

    owner = db_session.query(User).filter(User.email == email).one()
    while_granted = resolve_access(
        db_session, owner, now=PERIOD_END - timedelta(days=1)
    )
    after_period = resolve_access(
        db_session, owner, now=PERIOD_END + timedelta(seconds=1)
    )

    assert while_granted.state == AccessState.ACTIVE
    assert while_granted.subscription_status == SUBSCRIPTION_STATUS_CANCELED
    assert after_period.state == AccessState.FREE


def test_cancel_closes_the_dunning_window_of_a_past_due_row(
    provider, client, db_session: Session, plan: Plan
):
    """Cancelling a past_due row clears the §17.4 grace — nothing is owed after.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_PAST_DUE,
        provider_id="sub_late_1",
        grace_until=PERIOD_END,
    )

    response = _cancel(client, email)

    assert response.status_code == 200
    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_CANCELED
    assert fresh.grace_until is None
    assert len(provider.deletes) == 1


def test_cancel_is_idempotent_and_does_not_call_the_provider_again(
    provider, client, db_session: Session, plan: Plan
):
    """The webhook may cancel first: a second click answers 200, provider untouched.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_CANCELED,
        provider_id="sub_gone_1",
    )

    response = _cancel(client, email)

    assert response.status_code == 200
    assert datetime.fromisoformat(response.json()["current_period_end"]) == PERIOD_END
    assert provider.deletes == []
    fresh = _stored(db_session, row.id)
    assert as_utc(fresh.canceled_at) == FIXED_NOW - timedelta(days=1)


def test_cancel_does_not_touch_the_row_when_the_provider_refuses(
    provider, client, db_session: Session, plan: Plan
):
    """A refusal is a 502 with our words and an untouched row — never a quiet lie.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id="sub_refused_1",
    )
    provider.delete_status = 500

    response = _cancel(client, email)

    assert response.status_code == 502
    assert response.json()["detail"] == "Não foi possível cancelar. Tente novamente."
    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_ACTIVE
    assert fresh.canceled_at is None


def test_cancel_accepts_a_subscription_already_removed_at_the_provider(
    provider, client, db_session: Session, plan: Plan
):
    """404 on the DELETE means the recurrence is already gone: mirror it anyway.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id="sub_removed_1",
    )
    provider.delete_status = 404

    response = _cancel(client, email)

    assert response.status_code == 200
    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_CANCELED


def test_cancel_falls_back_to_the_provider_listing_when_the_id_is_missing(
    provider, client, db_session: Session, plan: Plan
):
    """Without our stored id the subscription is found by externalReference.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id=None,
        customer="cus_lookup_1",
    )
    provider.list_data = [
        {"id": "sub_found_1", "status": "ACTIVE", "externalReference": str(row.id)},
        {"id": "sub_other", "status": "ACTIVE", "externalReference": "someone-else"},
    ]

    response = _cancel(client, email)

    assert response.status_code == 200
    deletes = provider.deletes
    assert len(deletes) == 1
    assert deletes[0].url.path.endswith("/subscriptions/sub_found_1")
    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_CANCELED


def test_cancel_with_no_subscription_at_the_provider_cancels_locally(
    provider, client, db_session: Session, plan: Plan
):
    """An empty listing is an answer: there is nothing left to stop over there.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id=None,
        customer="cus_empty_1",
    )
    provider.list_data = []

    response = _cancel(client, email)

    assert response.status_code == 200
    assert provider.deletes == []
    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_CANCELED


def test_cancel_fails_closed_when_the_provider_cannot_be_asked(
    provider, client, db_session: Session, plan: Plan
):
    """An outage during the lookup never cancels locally — that is how charges survive a cancel.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id=None,
        customer="cus_outage_1",
    )
    provider.list_status = 500

    response = _cancel(client, email)

    assert response.status_code == 502
    fresh = _stored(db_session, row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_ACTIVE


# ── abandoned checkouts ──────────────────────────────────────────────────────


def test_cancel_discards_an_abandoned_checkout(
    provider, client, db_session: Session, plan: Plan
):
    """An unpaid session the buyer walks away from closes over there and here.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(db_session, user, plan, status=SUBSCRIPTION_STATUS_INCOMPLETE)
    row_id = row.id

    response = _cancel(client, email)

    assert response.status_code == 200
    assert response.json() == {"current_period_end": None}
    closes = provider.calls_to("POST", "/checkouts/chk_cx_1/cancel")
    assert len(closes) == 1
    assert _stored(db_session, row_id) is None


def test_cancel_discards_an_abandoned_checkout_whose_session_is_gone(
    provider, client, db_session: Session, plan: Plan
):
    """A session the provider already expired still frees the local seat.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(db_session, user, plan, status=SUBSCRIPTION_STATUS_INCOMPLETE)
    row_id = row.id
    provider.checkout_cancel_status = 404

    response = _cancel(client, email)

    assert response.status_code == 200
    assert _stored(db_session, row_id) is None


def test_cancel_discards_an_abandoned_checkout_without_a_stored_session(
    provider, client, db_session: Session, plan: Plan
):
    """Rows created before the checkout id existed have nothing to close there.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(
        db_session,
        user,
        plan,
        status=SUBSCRIPTION_STATUS_INCOMPLETE,
        checkout_id=None,
    )
    row_id = row.id

    response = _cancel(client, email)

    assert response.status_code == 200
    assert provider.requests == []
    assert _stored(db_session, row_id) is None


def test_cancel_keeps_the_abandoned_checkout_when_the_provider_refuses(
    provider, client, db_session: Session, plan: Plan
):
    """The session may still be payable: on a refusal nothing is discarded.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    user, email = _user(db_session)
    row = _seed(db_session, user, plan, status=SUBSCRIPTION_STATUS_INCOMPLETE)
    provider.checkout_cancel_status = 500

    response = _cancel(client, email)

    assert response.status_code == 502
    assert response.json()["detail"] == "Não foi possível cancelar. Tente novamente."
    fresh = _stored(db_session, row.id)
    assert fresh is not None
    assert fresh.status == SUBSCRIPTION_STATUS_INCOMPLETE


# ── authorization and empty states ───────────────────────────────────────────


def test_cancel_scopes_to_the_authenticated_user(
    provider, client, db_session: Session, plan: Plan
):
    """§17.7: no id in the path, no id in the body — another row cannot be reached.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    _victim, _victim_email = _user(db_session)
    victim_row = _seed(
        db_session,
        _victim,
        plan,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        provider_id="sub_victim_1",
    )
    _intruder, intruder_email = _user(db_session)

    response = _cancel(client, intruder_email)

    assert response.status_code == 404
    assert provider.deletes == []
    fresh = _stored(db_session, victim_row.id)
    assert fresh.status == SUBSCRIPTION_STATUS_ACTIVE


def test_cancel_of_a_user_without_any_row_is_404(provider, client):
    """A free user cancelling gets a safe 404, and the provider is never called.

    The user comes straight from `create_test_user` with no `db_session` in
    sight: this test asserts nothing about a row, and the fixture's savepoint
    does not survive a helper commit on the shared in-memory connection.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
    """
    email = f"cancel_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")

    response = _cancel(client, email)

    assert response.status_code == 404
    assert response.json()["detail"] == "Nenhuma assinatura para cancelar."
    assert provider.requests == []
