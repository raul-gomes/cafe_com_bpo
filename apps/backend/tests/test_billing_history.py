"""The billing history of the payments page, and the routes it retired (Fase 9).

`GET /payments/` feeds the "mês a mês" block of the payments screen. Three
properties are guarded here:

1. **Only subscription charges show** (§17.2): legacy one-off rows
   (`subscription_id IS NULL`) stay in the table and out of the screen, as the
   `Payment` model promises.
2. **The row is the contract the screen reads** (§6): six keys, money as a
   decimal string — a float in JSON is money the renderer would have to guess
   how to format.
3. **The old charge routes stay retired**: the page now opens the hosted
   checkout, and `POST /payments/create`, `POST /payments/customer` and
   `GET /payments/{id}` were the direct-charge surface of the form it replaced.
   A route that came back would be an unreviewed way to charge a customer.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from src.modules.auth.models import User
from src.modules.payments.models import Payment
from src.modules.subscriptions.models import (
    PRICE_SYNC_SYNCED,
    SUBSCRIPTION_STATUS_ACTIVE,
    Plan,
    Subscription,
)
from tests.helpers import auth_header, unique_email

HISTORY_KEYS = {"id", "cycle_month", "amount", "status", "paid_at", "invoice_url"}


def _user_id(db_session, email: str) -> UUID:
    """Looks up a registered user's id by e-mail.

    Args:
        db_session: Test database session.
        email: E-mail of the registered user.

    Returns:
        The user id.

    Raises:
        AssertionError: When no user matches the e-mail.
    """
    found = db_session.query(User.id).filter(User.email == email.lower()).first()
    assert found is not None, f"usuário {email} não encontrado"
    return found[0]


def _seed_subscription(db_session, user_id: UUID) -> UUID:
    """Seeds an active subscription so a charge can be tied to its cycle.

    Args:
        db_session: Test database session.
        user_id: Owner of the subscription.

    Returns:
        The subscription id.
    """
    plan = Plan(
        id=uuid4(),
        code="mensal",
        name="Cafe com BPO - Mensal",
        price=Decimal("27.90"),
        cycle="MONTHLY",
        is_active=True,
    )
    subscription = Subscription(
        id=uuid4(),
        user_id=user_id,
        plan_id=plan.id,
        status=SUBSCRIPTION_STATUS_ACTIVE,
        cycle="MONTHLY",
        price=Decimal("27.90"),
        asaas_customer_id=f"cus_{uuid4().hex[:12]}",
        asaas_checkout_id=f"chk_{uuid4().hex[:12]}",
        price_sync_status=PRICE_SYNC_SYNCED,
    )
    db_session.add_all([plan, subscription])
    db_session.commit()
    return subscription.id


def _seed_charge(
    db_session,
    *,
    user_id: UUID,
    subscription_id: UUID | None,
    cycle_month: str,
    paid_at: datetime | None,
    amount: str = "27.90",
) -> Payment:
    """Seeds one `payments` row as the webhook would have written it.

    Args:
        db_session: Test database session.
        user_id: Owner of the charge.
        subscription_id: Subscription the charge belongs to, or `None` for a
            legacy one-off row.
        cycle_month: Billing month as `YYYY-MM`.
        paid_at: Instant the money arrived, or `None` when unpaid.
        amount: Charge amount as a decimal string.

    Returns:
        The stored payment.
    """
    row = Payment(
        user_id=user_id,
        subscription_id=subscription_id,
        amount=Decimal(amount),
        payment_method="CREDIT_CARD",
        due_date=f"{cycle_month}-05",
        status="confirmed" if paid_at else "pending",
        cycle_month=cycle_month,
        paid_at=paid_at,
        invoice_url="https://sandbox.asaas.com/invoice/inv_1",
    )
    db_session.add(row)
    db_session.commit()
    return row


def test_history_shows_only_subscription_charges(client, db_session):
    """Legacy one-off rows stay in the table, out of the screen (§17.2).

    Args:
        client: FastAPI test client.
        db_session: Test database session.

    Returns:
        None. Asserts exactly one row, the subscription one.
    """
    email = unique_email("hist")
    auth = auth_header(client, email)
    user_id = _user_id(db_session, email)
    subscription_id = _seed_subscription(db_session, user_id)
    _seed_charge(
        db_session,
        user_id=user_id,
        subscription_id=None,
        cycle_month="2025-08",
        paid_at=datetime(2025, 8, 5, 12, 0, tzinfo=UTC),
    )
    _seed_charge(
        db_session,
        user_id=user_id,
        subscription_id=subscription_id,
        cycle_month="2026-09",
        paid_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
    )

    response = client.get("/payments/", headers=auth)

    assert response.status_code == 200, response.text
    rows = response.json()
    assert len(rows) == 1, f"legacy rows leaked into the history: {rows}"
    assert rows[0]["cycle_month"] == "2026-09"


def test_history_row_carries_exactly_what_the_screen_reads(client, db_session):
    """The six keys are the contract (§6); anything else is payload the screen ignores.

    Args:
        client: FastAPI test client.
        db_session: Test database session.

    Returns:
        None. Asserts the exact key set of the first row.
    """
    email = unique_email("hist")
    auth = auth_header(client, email)
    user_id = _user_id(db_session, email)
    subscription_id = _seed_subscription(db_session, user_id)
    _seed_charge(
        db_session,
        user_id=user_id,
        subscription_id=subscription_id,
        cycle_month="2026-09",
        paid_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
    )

    response = client.get("/payments/", headers=auth)

    assert response.status_code == 200, response.text
    assert set(response.json()[0]) == HISTORY_KEYS


def test_history_amount_is_a_decimal_string(client, db_session):
    """Money ships as text: the screen formats it, the API never returns a float.

    Args:
        client: FastAPI test client.
        db_session: Test database session.

    Returns:
        None. Asserts the type and value of `amount`.
    """
    email = unique_email("hist")
    auth = auth_header(client, email)
    user_id = _user_id(db_session, email)
    subscription_id = _seed_subscription(db_session, user_id)
    _seed_charge(
        db_session,
        user_id=user_id,
        subscription_id=subscription_id,
        cycle_month="2026-09",
        paid_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
        amount="27.90",
    )

    row = client.get("/payments/", headers=auth).json()[0]

    assert isinstance(row["amount"], str)
    assert row["amount"] == "27.90"


def test_history_lists_newest_paid_month_first(client, db_session):
    """The block reads top-down: the latest paid month is the first row.

    Args:
        client: FastAPI test client.
        db_session: Test database session.

    Returns:
        None. Asserts the order of `cycle_month`.
    """
    email = unique_email("hist")
    auth = auth_header(client, email)
    user_id = _user_id(db_session, email)
    subscription_id = _seed_subscription(db_session, user_id)
    _seed_charge(
        db_session,
        user_id=user_id,
        subscription_id=subscription_id,
        cycle_month="2026-08",
        paid_at=datetime(2026, 8, 5, 12, 0, tzinfo=UTC),
    )
    _seed_charge(
        db_session,
        user_id=user_id,
        subscription_id=subscription_id,
        cycle_month="2026-10",
        paid_at=datetime(2026, 10, 5, 12, 0, tzinfo=UTC),
    )

    rows = client.get("/payments/", headers=auth).json()

    assert [row["cycle_month"] for row in rows] == ["2026-10", "2026-08"]


def test_history_is_scoped_to_its_owner(client, db_session):
    """Two people never see each other's charges (§17.7).

    Args:
        client: FastAPI test client.
        db_session: Test database session.

    Returns:
        None. Asserts the stranger's history is empty.
    """
    owner_email = unique_email("hist_owner")
    auth_header(client, owner_email)
    owner_id = _user_id(db_session, owner_email)
    subscription_id = _seed_subscription(db_session, owner_id)
    _seed_charge(
        db_session,
        user_id=owner_id,
        subscription_id=subscription_id,
        cycle_month="2026-09",
        paid_at=datetime(2026, 9, 5, 12, 0, tzinfo=UTC),
    )
    stranger = auth_header(client, unique_email("hist_stranger"))

    response = client.get("/payments/", headers=stranger)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_history_is_empty_for_someone_who_never_paid(client):
    """A new account gets an empty list, not an error.

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the empty list.
    """
    auth = auth_header(client, unique_email("hist_new"))

    response = client.get("/payments/", headers=auth)

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_history_requires_authentication(client):
    """The charge history of a person is never readable anonymously.

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the 401.
    """
    response = client.get("/payments/")

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("post", "/payments/create"),
        ("post", "/payments/customer"),
    ],
)
def test_retired_charge_endpoints_stay_removed(client, method: str, path: str):
    """The direct-charge routes of the old form are gone; the page opens the hosted checkout.

    Args:
        client: FastAPI test client.
        method: HTTP method to send.
        path: Retired route path.

    Returns:
        None. Asserts 404 (gone) or 405 (method not allowed), never 401/422 —
        a live route would answer the others.
    """
    response = getattr(client, method)(path, json={})

    assert response.status_code in (404, 405), response.text


def test_retired_charge_detail_endpoint_stays_removed(client):
    """`GET /payments/{id}` belonged to the old screen; the list is the only read left.

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts 404 or 405.
    """
    response = client.get(f"/payments/{uuid4()}")

    assert response.status_code in (404, 405), response.text
