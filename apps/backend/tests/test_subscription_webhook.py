"""The webhook state machine of §17 — where a subscription becomes paid (Fase 5).

The local row is the authority and the provider only reports; seven rules are
protected here, each one a bug that would be silent on the screen:

1. **The provider id is the only identity (§17.7).** The subscription is found
   by `checkout.id`, `subscription.id` or `externalReference` — never by a
   `user_id` the payload could put in anybody's name.
2. **`CHECKOUT_PAID` promotes the row** (§17.2): `incomplete` → `active`, the
   provider subscription id is stored for every later event, and the paid period
   runs from the due date of the charge that was just made. Without this the
   payer stays free forever: `resolve_access` fails closed on a missing
   `current_period_end`.
3. **A checkout that never paid is deleted, a paid one never is.**
   `CHECKOUT_CANCELED`/`CHECKOUT_EXPIRED` remove the `incomplete` row (releasing
   the one-open-subscription index for a retry); the status guard is what keeps a
   late, reordered cancel from erasing a paid subscription.
4. **Each confirmed charge is one history row, and the period moves with it.**
   `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` activate, write the month that was
   paid and extend `current_period_end` — a paid month that fails to renew the
   period is the user losing access while up to date (§17.4's "volta ao normal
   sozinho").
5. **`PAYMENT_OVERDUE` opens exactly the §17.4 window**: `past_due` with
   `grace_until` = due date + 3 business days — and only from a subscription that
   was actually active, or an unpaid `incomplete` row would inherit the paying
   user's tolerance.
6. **`SUBSCRIPTION_INACTIVATED`/`SUBSCRIPTION_DELETED` cancel without taking the
   month away** (§17.5): access survives until `current_period_end`, which
   `_best_subscription` already honours.
7. **Idempotency lives in `webhook_events` (P-18).** A replay is acknowledged
   without reprocessing — including an event whose target does not exist, which
   the legacy per-payment `event_id` could never record. The answer is 200
   unless something unexpected breaks, because a non-2xx wedges the Asaas queue.

The dispatch answer is binary and observable: `"ok"` when the event changed at
least one row, `"ignored"` when it did not — a guard that kept a paid row safe,
an event with no target, or a replay. Asaas only reads the HTTP status, so this
split exists for the logs.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import httpx
import pytest
from sqlalchemy.orm import Session

from src.core.asaas_client import AsaasClient
from src.core.entitlements import AccessState, resolve_access
from src.core.time_utils import as_utc
from src.modules.auth.models import User
from src.modules.payments.models import Payment
from src.modules.payments.repository import PaymentRepository
from src.modules.payments.service import PaymentService
from src.modules.subscriptions.models import (
    PRICE_SYNC_SYNCED,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_INCOMPLETE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    Plan,
    Subscription,
)
from tests.helpers import create_test_user

WEBHOOK_TOKEN = "asaas-webhook-token-for-tests"

#: The clock every state machine test runs against, so the assertions on
#: `current_period_start`, `canceled_at` and `grace_until` never read the wall
#: clock of the machine running the suite.
FIXED_NOW = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)


def _business_day_start(year: int, month: int, day: int) -> datetime:
    """Returns the UTC instant a business day starts (midnight in São Paulo).

    Args:
        year: Year of the business day.
        month: Month of the business day.
        day: Day of the business day.

    Returns:
        The instant the day begins in America/Sao_Paulo, as UTC.
    """
    return datetime.fromisoformat(
        f"{year:04d}-{month:02d}-{day:02d}T00:00:00-03:00"
    ).astimezone(UTC)


def _run(coroutine):
    """Runs a coroutine to completion.

    `pytest-asyncio` is not a dependency of this project, so the tests drive the
    async dispatch directly.

    Args:
        coroutine: The coroutine to run.

    Returns:
        Whatever the coroutine returned.
    """
    import asyncio

    return asyncio.run(coroutine)


def _post(client, payload: dict):
    """Delivers one webhook through the real endpoint, token included.

    Args:
        client: FastAPI test client.
        payload: The Asaas event body.

    Returns:
        The HTTP response.
    """
    return client.post(
        "/payments/webhook",
        json=payload,
        headers={"asaas-access-token": WEBHOOK_TOKEN},
    )


def _process(db_session: Session, payload: dict, now: datetime = FIXED_NOW) -> str:
    """Runs one event through the dispatch with a frozen clock.

    Args:
        db_session: Database session.
        payload: The Asaas event body.
        now: Instant the state machine dates its writes with.

    Returns:
        `"ok"` when something was applied, `"ignored"` otherwise.
    """
    service = PaymentService(PaymentRepository(db_session))
    return _run(service.process_event(payload, now=now))


def _recorded_events(db_session: Session) -> list[tuple[str, str]]:
    """Lists the ids and types already recorded in `webhook_events`.

    Args:
        db_session: Database session.

    Returns:
        One `(event_id, event_type)` tuple per recorded event.
    """
    from src.modules.payments.models import WebhookEvent

    rows = db_session.query(WebhookEvent).order_by(WebhookEvent.event_id).all()
    return [(row.event_id, row.event_type) for row in rows]


def _checkout_event(
    event_id: str,
    event_type: str,
    *,
    checkout_id: str = "chk_wh_1",
    next_due: str = "2026-10-05T03:00:00+0000",
) -> dict:
    """Builds a `CHECKOUT_*` payload exactly as the provider documents it.

    No `externalReference` and no subscription id travel here — only
    `checkout.id` can find our row (P-16).

    Args:
        event_id: Asaas event id.
        event_type: Asaas event name.
        checkout_id: Checkout session id.
        next_due: Due date of the charge the checkout schedules.

    Returns:
        The webhook payload.
    """
    return {
        "id": event_id,
        "event": event_type,
        "checkout": {
            "id": checkout_id,
            "status": "PAID" if event_type == "CHECKOUT_PAID" else "ACTIVE",
            "customer": "cus_wh_1",
            "subscription": {"cycle": "MONTHLY", "nextDueDate": next_due},
        },
    }


def _payment_event(
    event_id: str,
    event_type: str,
    *,
    payment_id: str = "pay_wh_1",
    subscription: str | None = "sub_wh_1",
    checkout_session: str | None = None,
    due_date: str = "2026-10-05",
    date_payment: str = "2026-10-05 12:00:00",
) -> dict:
    """Builds a `PAYMENT_*` payload with the fields the state machine reads.

    Args:
        event_id: Asaas event id.
        event_type: Asaas event name.
        payment_id: Asaas payment id.
        subscription: Asaas subscription id, or `None` to omit the field.
        checkout_session: Checkout session id, or `None` to omit the field.
        due_date: Due date of the charge (YYYY-MM-DD).
        date_payment: Instant the payment was confirmed (provider format).

    Returns:
        The webhook payload.
    """
    payment: dict = {
        "id": payment_id,
        "status": "CONFIRMED" if event_type == "PAYMENT_CONFIRMED" else "PENDING",
        "customer": "cus_wh_1",
        "value": 27.9,
        "billingType": "CREDIT_CARD",
        "dueDate": due_date,
        "datePayment": date_payment,
        "description": "Cafe com BPO - Mensal",
        "invoiceUrl": "https://sandbox.asaas.com/webhook/invoice/inv_wh_1",
    }
    if subscription is not None:
        payment["subscription"] = subscription
    if checkout_session is not None:
        payment["checkoutSession"] = checkout_session
    return {"id": event_id, "event": event_type, "payment": payment}


def _subscription_event(
    event_id: str,
    event_type: str,
    *,
    provider_id: str | None = "sub_wh_1",
    external_reference: str | None = None,
) -> dict:
    """Builds a `SUBSCRIPTION_*` payload as the provider documents it.

    Args:
        event_id: Asaas event id.
        event_type: Asaas event name.
        provider_id: Asaas subscription id, or `None` to omit the field.
        external_reference: Our subscription id, or `None` to omit the field.

    Returns:
        The webhook payload.
    """
    subscription: dict = {
        "id": provider_id,
        "status": "DELETED",
        "customer": "cus_wh_1",
        "nextDueDate": "2026-11-05",
        "cycle": "MONTHLY",
    }
    if external_reference is not None:
        subscription["externalReference"] = external_reference
    return {"id": event_id, "event": event_type, "subscription": subscription}


@pytest.fixture
def webhook_settings(monkeypatch):
    """Configures the Asaas webhook token for the duration of a test.

    Args:
        monkeypatch: Pytest monkeypatch fixture.

    Returns:
        The reloaded settings instance.
    """
    monkeypatch.setenv("ASAAS_WEBHOOK_TOKEN", WEBHOOK_TOKEN)
    from src.core.config import get_settings

    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


@pytest.fixture
def subscription(db_session: Session) -> Subscription:
    """Seeds the state a hosted checkout leaves behind: unpaid, no provider id.

    Args:
        db_session: Database session.

    Returns:
        The `incomplete` subscription row with its checkout id.
    """
    email = f"wh_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")
    user = db_session.query(User).filter(User.email == email).one()
    plan = Plan(
        id=uuid4(),
        code="mensal",
        name="Cafe com BPO - Mensal",
        price=Decimal("27.90"),
        cycle="MONTHLY",
        is_active=True,
    )
    row = Subscription(
        id=uuid4(),
        user_id=user.id,
        plan_id=plan.id,
        status=SUBSCRIPTION_STATUS_INCOMPLETE,
        cycle="MONTHLY",
        price=Decimal("27.90"),
        asaas_customer_id="cus_wh_1",
        asaas_checkout_id="chk_wh_1",
        price_sync_status=PRICE_SYNC_SYNCED,
    )
    db_session.add_all([plan, row])
    db_session.commit()
    return row


def _stored(db_session: Session, subscription_id) -> Subscription:
    """Re-reads a subscription after the dispatch wrote through its own session.

    Args:
        db_session: Database session.
        subscription_id: Id of the row to read.

    Returns:
        The fresh row.
    """
    db_session.expire_all()
    return db_session.get(Subscription, subscription_id)


# ── CHECKOUT_* ───────────────────────────────────────────────────────────────


def test_checkout_paid_activates_the_row_and_stores_the_provider_subscription(
    db_session: Session, subscription: Subscription, monkeypatch
):
    """§17.2: the paid checkout is the promotion, and the provider id must be
    stored — every later event is matched by it.

    Args:
        db_session: Database session.
        subscription: The unpaid row waiting for the webhook.
        monkeypatch: Pytest monkeypatch fixture.
    """
    asked_for: list[str] = []

    async def _list_subscriptions(
        *args, customer: str, limit: int = 100, offset: int = 0
    ):
        asked_for.append(customer)
        return {
            "object": "list",
            "data": [
                {
                    "id": "sub_wh_1",
                    "status": "ACTIVE",
                    "customer": "cus_wh_1",
                    "nextDueDate": "2026-11-05",
                    "cycle": "MONTHLY",
                    "externalReference": str(subscription.id),
                }
            ],
        }

    monkeypatch.setattr(AsaasClient, "list_subscriptions", _list_subscriptions)

    outcome = _process(db_session, _checkout_event("evt_paid_1", "CHECKOUT_PAID"))

    assert outcome == "ok"
    assert asked_for == ["cus_wh_1"], "the lookup must be scoped to our customer"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE
    assert row.asaas_subscription_id == "sub_wh_1"
    assert as_utc(row.current_period_start) == FIXED_NOW
    # Due 2026-10-05, already paid: the period runs to the next charge.
    assert as_utc(row.current_period_end) == _business_day_start(2026, 11, 5)
    assert as_utc(row.next_billing_date) == _business_day_start(2026, 11, 5)
    assert row.grace_until is None


def test_checkout_paid_activates_even_when_the_provider_cannot_be_reached(
    db_session: Session, subscription: Subscription, monkeypatch
):
    """Money moved, so access cannot wait for a lookup that may be failing.

    The row is promoted from what the payload already carries; the provider id
    stays `None` and a later `PAYMENT_*` heals it through `checkoutSession`.

    Args:
        db_session: Database session.
        subscription: The unpaid row waiting for the webhook.
        monkeypatch: Pytest monkeypatch fixture.
    """

    async def _offline(*args, **kwargs) -> dict:
        raise httpx.ConnectError(
            "provider offline",
            request=httpx.Request("GET", "https://api.asaas.com/api/v3/subscriptions"),
        )

    monkeypatch.setattr(AsaasClient, "list_subscriptions", _offline)

    outcome = _process(db_session, _checkout_event("evt_paid_2", "CHECKOUT_PAID"))

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE
    assert row.asaas_subscription_id is None
    assert as_utc(row.current_period_end) == _business_day_start(2026, 11, 5)


def test_a_future_first_charge_ends_where_the_provider_says(
    db_session: Session, subscription: Subscription, monkeypatch
):
    """§17.6: a beta's first charge is dated after the free year, and the paid
    period must end on that future due date — not one cycle from today.

    Args:
        db_session: Database session.
        subscription: The unpaid row waiting for the webhook.
        monkeypatch: Pytest monkeypatch fixture.
    """

    async def _list_subscriptions(
        *args, customer: str, limit: int = 100, offset: int = 0
    ):
        return {"object": "list", "data": []}

    monkeypatch.setattr(AsaasClient, "list_subscriptions", _list_subscriptions)

    outcome = _process(
        db_session,
        _checkout_event(
            "evt_paid_3",
            "CHECKOUT_PAID",
            next_due="2027-06-01T03:00:00+0000",
        ),
    )

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE
    assert as_utc(row.current_period_end) == _business_day_start(2027, 6, 1)


def test_checkout_paid_regularizes_an_overdue_subscription(
    db_session: Session, subscription: Subscription
):
    """§17.4 "quem paga dentro da janela volta ao normal sozinho" — the
    regularize checkout (P-22, opção A) pays through the platform's own
    authority signal: `CHECKOUT_PAID` reactivates the `past_due` row, closes
    the grace window and advances the period, exactly as a settled payment
    does. The provider id is not touched: the recurrence it names belongs to
    the provider and is the key of every later event.

    Args:
        db_session: Database session.
        subscription: The `incomplete` row, turned overdue here.
    """
    subscription.status = SUBSCRIPTION_STATUS_PAST_DUE
    subscription.asaas_subscription_id = "sub_wh_1"
    subscription.current_period_end = _business_day_start(2026, 10, 5)
    subscription.grace_until = _business_day_start(2026, 10, 9)
    db_session.commit()

    outcome = _process(db_session, _checkout_event("evt_paid_reg", "CHECKOUT_PAID"))

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE
    assert row.grace_until is None
    # Charged 2026-10-05 (already overdue): the paid month renews the next cycle.
    assert as_utc(row.current_period_end) == _business_day_start(2026, 11, 5)
    assert row.asaas_subscription_id == "sub_wh_1"


def test_checkout_canceled_deletes_the_unpaid_row(
    db_session: Session, subscription: Subscription
):
    """Nothing was paid, so the row is not history — and while it exists the
    one-open-subscription index answers 409 to every retry.

    Args:
        db_session: Database session.
        subscription: The unpaid row waiting for the webhook.
    """
    outcome = _process(db_session, _checkout_event("evt_cancel_1", "CHECKOUT_CANCELED"))

    assert outcome == "ok"
    db_session.expire_all()
    remaining = (
        db_session.query(Subscription)
        .filter(Subscription.asaas_checkout_id == "chk_wh_1")
        .all()
    )
    assert remaining == []
    assert _recorded_events(db_session) == [("evt_cancel_1", "CHECKOUT_CANCELED")]


def test_checkout_canceled_after_payment_cannot_delete_a_paid_row(
    db_session: Session, subscription: Subscription
):
    """Out-of-order delivery is a given (the provider says so): a cancel that
    arrives after `CHECKOUT_PAID` must find a guard, not a delete button — the
    paid row survives, and the answer is `ignored` because nothing changed.

    Args:
        db_session: Database session.
        subscription: Row already promoted to `active`.
    """
    subscription.status = SUBSCRIPTION_STATUS_ACTIVE
    db_session.commit()

    outcome = _process(db_session, _checkout_event("evt_cancel_2", "CHECKOUT_CANCELED"))

    assert outcome == "ignored"
    row = _stored(db_session, subscription.id)
    assert row is not None
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE


# ── PAYMENT_* ────────────────────────────────────────────────────────────────


def test_payment_confirmed_activates_records_the_month_and_advances_the_period(
    db_session: Session, subscription: Subscription
):
    """The first charge confirms the subscription even if no checkout event ever
    arrives, and the paid month becomes the history row Fase 9 renders.

    Args:
        db_session: Database session.
        subscription: The unpaid row, with the provider id already stored.
    """
    subscription.asaas_subscription_id = "sub_wh_1"
    db_session.commit()

    outcome = _process(db_session, _payment_event("evt_conf_1", "PAYMENT_CONFIRMED"))

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE
    assert row.grace_until is None
    assert as_utc(row.current_period_end) == _business_day_start(2026, 11, 5)

    history = db_session.query(Payment).filter(Payment.subscription_id == row.id).all()
    assert len(history) == 1
    charged = history[0]
    assert charged.user_id == row.user_id
    assert charged.asaas_payment_id == "pay_wh_1"
    assert charged.cycle_month == "2026-10"
    assert charged.status == "confirmed"
    assert charged.amount == Decimal("27.90")
    assert charged.payment_method == "CREDIT_CARD"
    assert charged.due_date == "2026-10-05"
    assert charged.invoice_url == "https://sandbox.asaas.com/webhook/invoice/inv_wh_1"
    # 12:00 in São Paulo is 15:00 UTC: the provider stamps naive local time.
    assert as_utc(charged.paid_at) == datetime(2026, 10, 5, 15, 0, tzinfo=UTC)


def test_payment_received_updates_the_same_month_instead_of_duplicating_it(
    db_session: Session, subscription: Subscription
):
    """`CONFIRMED` then `RECEIVED` is one charge in two states (the provider
    documents the sequence), not two paid months.

    Args:
        db_session: Database session.
        subscription: The unpaid row, with the provider id already stored.
    """
    subscription.asaas_subscription_id = "sub_wh_1"
    db_session.commit()

    _process(db_session, _payment_event("evt_conf_2", "PAYMENT_CONFIRMED"))
    outcome = _process(
        db_session,
        _payment_event(
            "evt_recv_2", "PAYMENT_RECEIVED", date_payment="2026-10-05 13:00:00"
        ),
    )

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    history = db_session.query(Payment).filter(Payment.subscription_id == row.id).all()
    assert len(history) == 1
    assert history[0].status == "received"
    assert as_utc(history[0].paid_at) == datetime(2026, 10, 5, 16, 0, tzinfo=UTC)


def test_payment_event_matches_by_checkout_session_and_heals_the_provider_id(
    db_session: Session, subscription: Subscription
):
    """The fallback chain of §10.2 saves the row the lookup of `CHECKOUT_PAID`
    could not identify: `payment.subscription` then becomes known.

    Args:
        db_session: Database session.
        subscription: The unpaid row whose provider id was never stored.
    """
    assert subscription.asaas_subscription_id is None

    outcome = _process(
        db_session,
        _payment_event(
            "evt_sess_1",
            "PAYMENT_CONFIRMED",
            checkout_session="chk_wh_1",
        ),
    )

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_ACTIVE
    assert row.asaas_subscription_id == "sub_wh_1"
    assert (
        db_session.query(Payment).filter(Payment.subscription_id == row.id).count() == 1
    )


def test_payment_overdue_opens_the_three_day_grace_window(
    db_session: Session, subscription: Subscription
):
    """§17.4: `past_due` with grace through the end of due + 3 business days —
    and the tolerance may only be opened on a subscription that was paying,
    or an unpaid checkout would inherit it.

    Args:
        db_session: Database session.
        subscription: Row already active with the provider id stored.
    """
    subscription.status = SUBSCRIPTION_STATUS_ACTIVE
    subscription.asaas_subscription_id = "sub_wh_1"
    db_session.commit()

    outcome = _process(db_session, _payment_event("evt_over_1", "PAYMENT_OVERDUE"))

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == "past_due"
    assert as_utc(row.grace_until) == _business_day_start(2026, 10, 9)


def test_payment_overdue_on_an_unpaid_checkout_changes_nothing(
    db_session: Session, subscription: Subscription
):
    """An `incomplete` row never paid, so §17.4's tolerance is not its to take.

    Args:
        db_session: Database session.
        subscription: The unpaid row waiting for the webhook.
    """
    outcome = _process(db_session, _payment_event("evt_over_2", "PAYMENT_OVERDUE"))

    assert outcome == "ignored"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_INCOMPLETE
    assert row.grace_until is None


# ── SUBSCRIPTION_* ───────────────────────────────────────────────────────────


def test_subscription_inactivated_marks_the_row_canceled_without_taking_access(
    db_session: Session, subscription: Subscription
):
    """§17.5: cancellation ends the recurrence, not the month already paid —
    `resolve_access` must still answer `active` inside `current_period_end`.

    Args:
        db_session: Database session.
        subscription: Row already active for a paid period.
    """
    subscription.status = SUBSCRIPTION_STATUS_ACTIVE
    subscription.asaas_subscription_id = "sub_wh_1"
    subscription.current_period_end = _business_day_start(2026, 11, 5)
    db_session.commit()

    outcome = _process(
        db_session,
        _subscription_event("evt_inact_1", "SUBSCRIPTION_INACTIVATED"),
    )

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_CANCELED
    assert as_utc(row.canceled_at) == FIXED_NOW

    user = db_session.get(User, subscription.user_id)
    access = resolve_access(db_session, user, now=datetime(2026, 10, 7, 12, tzinfo=UTC))
    assert access.state is AccessState.ACTIVE


def test_subscription_deleted_marks_the_row_canceled(
    db_session: Session, subscription: Subscription
):
    """The second lifecycle event of §10.3 lands on the same guarded transition.

    Args:
        db_session: Database session.
        subscription: Row already active with the provider id stored.
    """
    subscription.status = SUBSCRIPTION_STATUS_ACTIVE
    subscription.asaas_subscription_id = "sub_wh_1"
    db_session.commit()

    outcome = _process(
        db_session, _subscription_event("evt_del_1", "SUBSCRIPTION_DELETED")
    )

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_CANCELED


def test_subscription_event_matches_by_external_reference_when_the_id_is_missing(
    db_session: Session, subscription: Subscription
):
    """When the enrichment of `CHECKOUT_PAID` failed, `externalReference` is the
    only key left to reconcile a `SUBSCRIPTION_*` event on (§10.2).

    Args:
        db_session: Database session.
        subscription: Active row whose provider id was never stored.
    """
    subscription.status = SUBSCRIPTION_STATUS_ACTIVE
    subscription.asaas_subscription_id = None
    db_session.commit()

    outcome = _process(
        db_session,
        _subscription_event(
            "evt_ref_1",
            "SUBSCRIPTION_DELETED",
            provider_id=None,
            external_reference=str(subscription.id),
        ),
    )

    assert outcome == "ok"
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_CANCELED


# ── idempotência, contrato e isolamento (endpoint real) ──────────────────────


def test_replayed_event_is_processed_once_only(
    client, webhook_settings, db_session: Session, subscription: Subscription
):
    """At-least-once delivery: the second copy is acknowledged and changes
    nothing — including events whose first copy already deleted their target.

    Args:
        client: FastAPI test client.
        webhook_settings: Configured Asaas webhook token.
        db_session: Database session.
        subscription: Row active with the provider id stored.
    """
    subscription.status = SUBSCRIPTION_STATUS_ACTIVE
    subscription.asaas_subscription_id = "sub_wh_1"
    db_session.commit()
    payload = _subscription_event("evt_rep_1", "SUBSCRIPTION_DELETED")

    first = _post(client, payload)
    second = _post(client, payload)

    assert first.status_code == 200, first.text
    assert first.json() == {"status": "ok"}
    assert second.status_code == 200, second.text
    assert second.json() == {"status": "ignored"}
    assert len(_recorded_events(db_session)) == 1
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_CANCELED


def test_event_with_no_known_target_is_recorded_and_acknowledged(
    client, webhook_settings, db_session: Session
):
    """P-18: the legacy idempotency stored one `event_id` *per payment row*, so
    an event with no row at all could never be recorded — and a replay would be
    reprocessed forever. The event table covers every arrival.

    Args:
        client: FastAPI test client.
        webhook_settings: Configured Asaas webhook token.
        db_session: Database session.
    """
    payload = _payment_event("evt_lost_1", "PAYMENT_CONFIRMED", subscription="sub_nope")

    first = _post(client, payload)
    second = _post(client, payload)

    assert first.status_code == 200, first.text
    assert first.json() == {"status": "ignored"}
    assert second.status_code == 200, second.text
    assert second.json() == {"status": "ignored"}
    assert _recorded_events(db_session) == [("evt_lost_1", "PAYMENT_CONFIRMED")]


def test_a_user_id_in_the_payload_cannot_reach_any_subscription(
    client, webhook_settings, db_session: Session, subscription: Subscription
):
    """§17.7: the webhook never trusts the payload's identity — only the
    provider's ids locate a row.

    Args:
        client: FastAPI test client.
        webhook_settings: Configured Asaas webhook token.
        db_session: Database session.
        subscription: The unpaid row of the victim.
    """
    payload = _checkout_event("evt_evil_1", "CHECKOUT_PAID", checkout_id="chk_nope")
    payload["user_id"] = str(subscription.user_id)

    response = _post(client, payload)

    assert response.status_code == 200, response.text
    assert response.json() == {"status": "ignored"}
    row = _stored(db_session, subscription.id)
    assert row.status == SUBSCRIPTION_STATUS_INCOMPLETE


def test_the_webhook_response_carries_only_the_status(
    client, webhook_settings, db_session: Session
):
    """§6: a field ships only if somebody reads it — Asaas reads nothing, and
    an id in the body would be an internal identifier leaving the service.

    Args:
        client: FastAPI test client.
        webhook_settings: Configured Asaas webhook token.
        db_session: Database session.
    """
    response = _post(client, _payment_event("evt_keys_1", "PAYMENT_RECEIVED"))

    assert response.status_code == 200, response.text
    assert set(response.json()) == {"status"}


def test_the_cycle_addition_clamps_to_the_short_month():
    """A charge on the 31st must land on the last day of the next month, or the
    period would end a day before the provider's due date in February.

    Returns:
        None; asserts the clamp.
    """
    from datetime import date

    from src.modules.subscriptions.service import add_billing_month

    assert add_billing_month(date(2026, 1, 31)) == date(2026, 2, 28)
    assert add_billing_month(date(2026, 10, 5)) == date(2026, 11, 5)
