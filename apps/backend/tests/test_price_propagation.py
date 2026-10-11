"""Price propagation and daily reconciliation (Fase 7, §17.1/D13).

When an admin edits the plan's price, every live subscription of that plan must
learn the new value **before the next cycle** — the provider generates the next
charge ~40 days ahead, so `PUT /v3/subscriptions/{id}` carries the new price and
`price_sync_status` records whether the provider agreed.

Four behaviours are protected here, each one a plausible silent bug:

1. **The new price applies from the next cycle, never retroactively.** The edit
   updates `subscription.price` and the sync status only; `current_period_end`
   (a month already paid) never moves.
2. **The status is the drift detector.** A refused or unreachable push leaves
   the row `failed` (never silently `synced`), the resync endpoint retries it,
   and the daily reconciliation re-pushes every `pending`/`failed` row with the
   plan's current price.
3. **A plan that cannot be charged never reaches the provider.** Activation is
   refused when the price is null or zero (§17.1, 400), and one thing zeroes a
   plan that already has subscribers: the edit is refused (422, decision of the
   product owner on 2026-10-06).
4. **The provider is only told what it needs to know.** Rows already `synced`
   at the current price are skipped, and `incomplete`/`canceled` rows never
   trigger a call.
"""

import asyncio
import json
import re
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.orm import Session

from src.core.asaas_client import AsaasClient
from src.core.config import get_settings
from src.core.database import SessionLocal
from src.core.time_utils import as_utc
from src.modules.auth.models import User
from src.modules.subscriptions.models import (
    PRICE_SYNC_FAILED,
    PRICE_SYNC_PENDING,
    PRICE_SYNC_SYNCED,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_INCOMPLETE,
    Plan,
    Subscription,
)
from src.modules.subscriptions.service import (
    PricePropagationService,
    SubscriptionWebhookService,
)
from tests.helpers import TEST_PASSWORD, create_test_user

FIXED_NOW = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)
PERIOD_END = FIXED_NOW + timedelta(days=25)


def _run(coroutine):
    """Runs a coroutine to completion (pytest-asyncio is not a dependency).

    Args:
        coroutine: Coroutine to drive.

    Returns:
        Whatever the coroutine returned.
    """
    return asyncio.run(coroutine)


@pytest.fixture
def provider(monkeypatch):
    """Serves fake Asaas answers and records what the client asked for.

    Mirrors the checkout fixture: the transport is swapped with
    `httpx.MockTransport`, so the propagation runs against the real client code
    while the test stays offline.

    Args:
        monkeypatch: pytest monkeypatch fixture.

    Returns:
        A mutable object with the recorded `requests` and toggles for the
        `PUT /subscriptions/{id}` answer and the `GET /subscriptions` listing.
    """

    class Provider:
        def __init__(self) -> None:
            self.requests: list[httpx.Request] = []
            self.update_status = 200
            self.list_payload: dict = {"data": []}

        def updates(self) -> list[httpx.Request]:
            """The recorded `PUT /subscriptions/{id}` calls.

            Returns:
                The list, in order; empty when the provider was never told
                to change a subscription.
            """
            return [
                r
                for r in self.requests
                if r.method == "PUT"
                and re.search(r"/subscriptions/[^/]+/?$", r.url.path)
            ]

        def body_of(self, request: httpx.Request) -> dict:
            """Decodes the JSON body of a recorded request.

            Args:
                request: Recorded request.

            Returns:
                The decoded body.
            """
            return json.loads(request.content)

    fake = Provider()

    def handler(request: httpx.Request) -> httpx.Response:
        fake.requests.append(request)
        if request.method == "GET" and request.url.path.endswith("/subscriptions"):
            return httpx.Response(200, json=fake.list_payload)
        if request.method == "PUT" and re.search(
            r"/subscriptions/[^/]+/?$", request.url.path
        ):
            if fake.update_status != 200:
                return httpx.Response(
                    fake.update_status, json={"errors": [{"code": "fake-refusal"}]}
                )
            subscription_id = request.url.path.rstrip("/").rsplit("/", 1)[-1]
            return httpx.Response(
                200,
                json={
                    "id": subscription_id,
                    "value": fake.body_of(request).get("value"),
                },
            )
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


@pytest.fixture
def plan(db_session: Session) -> Plan:
    """Seeds the monthly plan at R$ 27,90.

    Args:
        db_session: Database session.

    Returns:
        The active plan.
    """
    row = Plan(
        id=uuid4(),
        code="mensal",
        name="Mensal",
        price=Decimal("27.90"),
        cycle="MONTHLY",
        is_active=True,
    )
    db_session.add(row)
    db_session.commit()
    return row


def _seed_subscription(
    db_session: Session,
    plan: Plan,
    *,
    status: str = SUBSCRIPTION_STATUS_ACTIVE,
    price: str = "27.90",
    provider_id: str | None = "sub_1",
    customer_id: str | None = "cus_1",
    checkout_id: str | None = None,
    sync_status: str = PRICE_SYNC_SYNCED,
    period_end=None,
) -> Subscription:
    """Creates a user and its subscription row in one `db_session` commit.

    The user is seeded here rather than through `create_test_user`: a helper
    that commits on its own session would be the only way to keep the price
    drifted, but it is exactly the pattern of P-19 — a commit on the shared
    connection destroys `db_session`'s savepoint. One commit in `db_session`
    keeps the fixture transaction clean.

    Args:
        db_session: Database session.
        plan: Plan the subscription belongs to.
        status: Subscription status.
        price: Subscription price (what the current cycle cost).
        provider_id: Asaas subscription id, `None` when unexplored.
        customer_id: Asaas customer id, `None` when absent.
        checkout_id: Asaas checkout session id, `None` when paid long ago.
        sync_status: `price_sync_status` of the new row.
        period_end: `current_period_end` to freeze, `None` for a virgin row.

    Returns:
        The seeded subscription.
    """
    user = User(
        email=f"prop_{uuid4().hex}@cafe.com",
        password_hash="unused-in-this-test",
        name="Propagation User",
    )
    db_session.add(user)
    db_session.flush()
    sub = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        status=status,
        cycle="MONTHLY",
        price=Decimal(price),
        asaas_customer_id=customer_id,
        asaas_subscription_id=provider_id,
        asaas_checkout_id=checkout_id,
        price_sync_status=sync_status,
        current_period_end=period_end,
    )
    db_session.add(sub)
    db_session.commit()
    return sub


def _admin_headers(client) -> dict:
    """Registers an admin and returns its authorization header.

    Args:
        client: FastAPI test client.

    Returns:
        The `Authorization` header of the new session.
    """
    email = f"prop_admin_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="admin")
    token = client.post(
        "/auth/login", data={"username": email, "password": TEST_PASSWORD}
    )
    assert token.status_code == 200, token.text
    return {"Authorization": f"Bearer {token.json()['access_token']}"}


def _read_sub(subscription_id) -> Subscription:
    """Reads a subscription on a fresh session, detached from any fixture.

    The HTTP writes of these tests commit on the shared connection and would
    kill `db_session`'s savepoint (P-19), so the assertions never touch the
    fixture session after a request.

    Args:
        subscription_id: The row to read.

    Returns:
        The subscription, with its plan eagerly loaded.
    """
    with SessionLocal() as session:
        return session.get(Subscription, subscription_id)


def _read_plan(plan_id) -> Plan:
    """Reads a plan on a fresh session (see `_read_sub`).

    Args:
        plan_id: The row to read.

    Returns:
        The plan.
    """
    with SessionLocal() as session:
        return session.get(Plan, plan_id)


def _buyer(client, email: str) -> dict:
    """Logs in as a buyer the test already seeded (see `_seed_subscription`).

    Args:
        client: FastAPI test client.
        email: The seeded buyer's email.

    Returns:
        The authorization header.
    """
    token = client.post(
        "/auth/login", data={"username": email, "password": TEST_PASSWORD}
    )
    assert token.status_code == 200, token.text
    return {"Authorization": f"Bearer {token.json()['access_token']}"}


def test_plan_edit_propagates_the_new_price_to_active_subscriptions(
    client, db_session: Session, plan: Plan, provider
):
    """Editing the price tells Asaas about the next cycle's value.

    The active subscription keeps its row but learns the new price, and the
    provider is updated with exactly that value (`PUT` carries only
    `value` — Asaas would reset the rest if we sent an empty schedule).

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(db_session, plan, period_end=PERIOD_END)

    response = client.patch(
        f"/plans/{plan.id}",
        json={"price": "31.90"},
        headers=_admin_headers(client),
    )

    assert response.status_code == 200, response.text
    assert response.json()["price"] == "31.90"

    calls = provider.updates()
    assert len(calls) == 1
    assert calls[0].url.path.endswith("/subscriptions/sub_1")
    assert provider.body_of(calls[0]) == {"value": 31.9}

    stored = _read_sub(sub.id)
    assert stored.price == Decimal("31.90")
    assert stored.price_sync_status == PRICE_SYNC_SYNCED
    assert stored.price_synced_at is not None
    # The paid month already granted stays: the new price applies from the
    # next cycle, never retroactively.
    assert as_utc(stored.current_period_end) == PERIOD_END


def test_incomplete_and_canceled_subscriptions_are_not_sent_to_the_provider(
    client, db_session: Session, plan: Plan, provider
):
    """Only live rows need the new price; the rest never trigger a call.

    An unpaid checkout has no subscription at the provider yet and a canceled
    row is history — hitting `PUT` for either would be a wasted call or an
    error against a dead id.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    incomplete = _seed_subscription(
        db_session, plan, status=SUBSCRIPTION_STATUS_INCOMPLETE, provider_id=None
    )
    canceled = _seed_subscription(
        db_session,
        plan,
        status=SUBSCRIPTION_STATUS_CANCELED,
        provider_id="sub_canceled",
    )

    response = client.patch(
        f"/plans/{plan.id}",
        json={"price": "31.90"},
        headers=_admin_headers(client),
    )

    assert response.status_code == 200, response.text
    assert provider.updates() == []
    assert _read_sub(incomplete.id).price == Decimal("27.90")
    assert _read_sub(canceled.id).price_sync_status == PRICE_SYNC_SYNCED


def test_plan_edit_without_subscribers_calls_no_provider(
    client, db_session: Session, plan: Plan, provider
):
    """A plan nobody subscribes to costs nobody a provider round-trip.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan (no subscribers).
        provider: Fake Asaas transport.
    """
    response = client.patch(
        f"/plans/{plan.id}", json={"price": "31.90"}, headers=_admin_headers(client)
    )

    assert response.status_code == 200, response.text
    assert provider.updates() == []
    assert _read_plan(plan.id).price == Decimal("31.90")


def test_editing_back_to_the_same_price_calls_no_provider(
    client, db_session: Session, plan: Plan, provider
):
    """An unchanged price is already synced: zero provider traffic.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    _seed_subscription(db_session, plan)
    _seed_subscription(db_session, plan, provider_id="sub_2")

    response = client.patch(
        f"/plans/{plan.id}", json={"price": "27.90"}, headers=_admin_headers(client)
    )

    assert response.status_code == 200, response.text
    assert provider.updates() == []


def test_provider_refusal_marks_the_row_failed_but_keeps_the_edit(
    client, db_session: Session, plan: Plan, provider
):
    """A refused push never fails the admin's edit — it records the drift.

    The local price is still updated (it is what the user should pay once the
    provider heals) and `price_sync_status` carries the `failed` so the daily
    reconciliation knows there is work to redo.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport (refusing).
    """
    sub = _seed_subscription(db_session, plan)
    provider.update_status = 422

    response = client.patch(
        f"/plans/{plan.id}", json={"price": "31.90"}, headers=_admin_headers(client)
    )

    assert response.status_code == 200, response.text
    assert len(provider.updates()) == 1
    stored = _read_sub(sub.id)
    assert stored.price == Decimal("31.90")
    assert stored.price_sync_status == PRICE_SYNC_FAILED


def test_resync_endpoint_retries_and_heals_a_failed_row(
    client, db_session: Session, plan: Plan, provider
):
    """The admin's resync button re-runs the propagation until it agrees.

    A row that failed moments ago is pushed again when the admin asks — and
    the response is the counts the Config screen renders.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(
        db_session, plan, price="31.90", sync_status=PRICE_SYNC_FAILED
    )

    response = client.post(
        f"/plans/{plan.id}/sync-prices", headers=_admin_headers(client)
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"synced": 1, "failed": 0, "skipped": 0}
    assert len(provider.updates()) == 1
    stored = _read_sub(sub.id)
    assert stored.price_sync_status == PRICE_SYNC_SYNCED
    assert stored.price_synced_at is not None


def test_resync_endpoint_requires_an_admin(client, db_session: Session, plan: Plan):
    """The resync button belongs to the Config tab: §17.1 admins only.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
    """
    email = f"prop_user_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")
    token = client.post(
        "/auth/login", data={"username": email, "password": TEST_PASSWORD}
    )
    headers = {"Authorization": f"Bearer {token.json()['access_token']}"}

    response = client.post(f"/plans/{plan.id}/sync-prices", headers=headers)

    assert response.status_code == 403, response.text


def test_admin_cannot_zero_the_price_of_a_plan_with_subscribers(
    client, db_session: Session, plan: Plan, provider
):
    """Zeroing a plan that has live subscribers is refused (decision 2026-10-06).

    Propagation to the provider would carry `value = 0`, which Asaas refuses,
    and a stuck `failed` retried every day is not a status — it is how a plan
    silently stops being billable. The edit is refused before the provider.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    _seed_subscription(db_session, plan)

    response = client.patch(
        f"/plans/{plan.id}", json={"price": "0.00"}, headers=_admin_headers(client)
    )

    assert response.status_code == 422, response.text
    assert _read_plan(plan.id).price == Decimal("27.90")
    assert provider.updates() == []


def test_admin_can_zero_a_plan_without_live_subscribers(
    client, db_session: Session, plan: Plan, provider
):
    """No live subscriber → nothing to propagate → zero is allowed.

    Activation itself stays blocked by the checkout guard up ahead (§17.1), but
    there is no drift for a plan nobody subscribes to.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    _seed_subscription(db_session, plan, status=SUBSCRIPTION_STATUS_CANCELED)

    response = client.patch(
        f"/plans/{plan.id}", json={"price": "0.00"}, headers=_admin_headers(client)
    )

    assert response.status_code == 200, response.text
    assert response.json()["price"] == "0.00"
    assert provider.updates() == []


def test_checkout_refuses_a_zero_price_plan(
    client, db_session: Session, plan: Plan, provider
):
    """§17.1: a plan priced zero can never be activated — refused, nothing sold.

    The guard fires before the billing profile is even consulted: the buyer who
    forgot their data must not see a 422 (missing billing) for a plan that has
    a problem of its own.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    plan.price = Decimal("0.00")
    db_session.commit()

    buyer_email = f"prop_buyer_{uuid4().hex}@cafe.com"
    create_test_user(email=buyer_email, role="user")

    response = client.post(
        "/subscriptions/checkout",
        json={"plan_id": str(plan.id)},
        headers=_buyer(client, buyer_email),
    )

    assert response.status_code == 400, response.text
    assert provider.requests == []
    with SessionLocal() as session:
        assert (
            session.query(Subscription).filter(Subscription.plan_id == plan.id).count()
            == 0
        )


def test_daily_reconciliation_pushes_the_drifted_rows_with_the_current_price(
    db_session: Session, plan: Plan, provider
):
    """The daily task heals every `pending`/`failed` row of a billable plan.

    Rows already `synced` at the current price are left alone; the drifted ones
    are pushed with the plan's price, from the plan row — the only source of
    truth (§17.1). A row marked `synced` at a stale older price is drift too:
    the flag recorded the last good push, and reconciliation exists precisely
    to catch the rows that desync silently.

    Args:
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    drifted_pending = _seed_subscription(
        db_session, plan, sync_status=PRICE_SYNC_PENDING
    )
    drifted_failed = _seed_subscription(
        db_session, plan, provider_id="sub_2", sync_status=PRICE_SYNC_FAILED
    )
    reconciled = _seed_subscription(
        db_session, plan, provider_id="sub_3", price="31.90"
    )
    plan.price = Decimal("31.90")
    db_session.commit()

    result = _run(
        PricePropagationService(db_session, AsaasClient()).reconcile_pending(
            now=FIXED_NOW
        )
    )

    assert result.synced == 2
    assert result.failed == 0
    assert result.skipped == 1
    assert len(provider.updates()) == 2
    assert {provider.body_of(call)["value"] for call in provider.updates()} == {31.9}
    assert _read_sub(drifted_pending.id).price_sync_status == PRICE_SYNC_SYNCED
    assert _read_sub(drifted_failed.id).price_sync_status == PRICE_SYNC_SYNCED
    assert _read_sub(reconciled.id).price_sync_status == PRICE_SYNC_SYNCED


def test_reconcile_heals_a_missing_provider_id_through_the_lookup(
    db_session: Session, plan: Plan, provider
):
    """A drifted row whose provider id was never stored is found and healed.

    `CHECKOUT_PAID` stores the id best-effort; a drift on a row that missed it
    is looked up by our external reference before the price is pushed.

    Args:
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(
        db_session,
        plan,
        provider_id=None,
        sync_status=PRICE_SYNC_FAILED,
    )
    provider.list_payload = {
        "data": [
            {
                "id": "sub_healed",
                "externalReference": str(sub.id),
                "status": "ACTIVE",
                "nextDueDate": "2026-11-05",
            }
        ]
    }
    plan.price = Decimal("31.90")
    db_session.commit()

    result = _run(
        PricePropagationService(db_session, AsaasClient()).reconcile_pending(
            now=FIXED_NOW
        )
    )

    assert result.synced == 1
    put = provider.updates()[0]
    assert put.url.path.endswith("/subscriptions/sub_healed")
    assert provider.body_of(put)["value"] == 31.9
    stored = _read_sub(sub.id)
    assert stored.asaas_subscription_id == "sub_healed"
    assert stored.price == Decimal("31.90")
    assert stored.price_sync_status == PRICE_SYNC_SYNCED


def test_propagation_never_moves_the_paid_period(
    db_session: Session, plan: Plan, provider
):
    """The rule "applies from the next cycle" is a line in the sand.

    Args:
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(db_session, plan, period_end=PERIOD_END)
    plan.price = Decimal("35.90")
    db_session.commit()

    _run(
        PricePropagationService(db_session, AsaasClient()).propagate_for_plan_id(
            plan.id, now=FIXED_NOW
        )
    )

    assert provider.updates()[0].url.path.endswith("/subscriptions/sub_1")
    stored = _read_sub(sub.id)
    assert stored.price == Decimal("35.90")
    assert as_utc(stored.current_period_end) == PERIOD_END


def test_propagate_is_idempotent_for_already_synced_rows(
    db_session: Session, plan: Plan, provider
):
    """Pushing again a row already synced at the current price is a no-op.

    Args:
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    _seed_subscription(db_session, plan)

    result = _run(
        PricePropagationService(db_session, AsaasClient()).propagate_for_plan_id(
            plan.id, now=FIXED_NOW
        )
    )

    assert result == (0, 0, 1)
    assert provider.updates() == []


def _promote_checkout(db_session: Session, sub: Subscription):
    """Runs `CHECKOUT_PAID` for a seeded `incomplete` row.

    Args:
        db_session: Database session.
        sub: The `incomplete` row to promote.
    """
    payload = {
        "checkout": {
            "id": sub.asaas_checkout_id,
            "subscription": {"nextDueDate": "2026-11-05"},
        }
    }
    return _run(
        SubscriptionWebhookService(db_session, AsaasClient()).apply_checkout(
            "CHECKOUT_PAID", payload, now=FIXED_NOW
        )
    )


def test_promotion_marks_the_price_pending_when_the_plan_price_moved(
    db_session: Session, plan: Plan, provider
):
    """A price changed during the checkout waits for the next cycle.

    The session was opened at R$ 27,90 but the plan now costs 31,90: the first
    charge (already generated) keeps the old value, so the row is promoted and
    flagged `pending` — the daily reconciliation pushes the new price before
    the next charge is generated.

    Args:
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(
        db_session,
        plan,
        status=SUBSCRIPTION_STATUS_INCOMPLETE,
        checkout_id="chk_1",
        provider_id=None,
    )
    provider.list_payload = {
        "data": [
            {
                "id": "sub_promoted",
                "externalReference": str(sub.id),
                "status": "ACTIVE",
                "nextDueDate": "2026-11-05",
            }
        ]
    }
    plan.price = Decimal("31.90")
    db_session.commit()

    assert _promote_checkout(db_session, sub) is True
    assert sub.status == SUBSCRIPTION_STATUS_ACTIVE
    assert sub.asaas_subscription_id == "sub_promoted"
    assert sub.price_sync_status == PRICE_SYNC_PENDING


def test_promotion_with_an_unchanged_plan_price_stays_synced(
    db_session: Session, plan: Plan, provider
):
    """No price movement during the checkout → nothing to reconcile.

    Args:
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(
        db_session,
        plan,
        status=SUBSCRIPTION_STATUS_INCOMPLETE,
        checkout_id="chk_1",
        provider_id=None,
    )
    provider.list_payload = {
        "data": [
            {
                "id": "sub_promoted",
                "externalReference": str(sub.id),
                "status": "ACTIVE",
                "nextDueDate": "2026-11-05",
            }
        ]
    }

    assert _promote_checkout(db_session, sub) is True
    assert sub.price_sync_status == PRICE_SYNC_SYNCED


def test_admin_patch_without_price_does_not_touch_sync_status(
    client, db_session: Session, plan: Plan, provider
):
    """A rename is not a price change: drift is left exactly as it was.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Seeded plan.
        provider: Fake Asaas transport.
    """
    sub = _seed_subscription(
        db_session, plan, sync_status=PRICE_SYNC_FAILED, price="31.90"
    )

    response = client.patch(
        f"/plans/{plan.id}",
        json={"name": "Mensal Promo"},
        headers=_admin_headers(client),
    )

    assert response.status_code == 200, response.text
    assert provider.updates() == []
    assert _read_sub(sub.id).price_sync_status == PRICE_SYNC_FAILED
