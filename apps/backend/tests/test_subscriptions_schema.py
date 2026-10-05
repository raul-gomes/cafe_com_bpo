"""Schema of the monthly subscription and the beta program (rule §17).

Covers phase 1 of `docs/plano-pagamentos.md`: the four new tables, the cycle
columns in `payments` and the beta grant.

The `payment_methods` test is deliberately **structural**: it fails if someone
adds a column holding sensitive card data (number, CVV, token). Rule §17.2
forbids storing number/CVV/token, and the cheap way to enforce it is to forbid
the column rather than trust review discipline.
"""

import datetime as dt
import uuid
from decimal import Decimal

import pytest
import sqlalchemy.exc
from sqlalchemy import Numeric
from sqlalchemy.orm import Session

from src.core.database import Base
from src.core.time_utils import as_utc
from src.modules.auth.models import User
from src.modules.payments.models import Payment
from src.modules.subscriptions.beta import (
    BETA_DURATION_DAYS,
    beta_expiry_from,
    grant_beta_to_all_users,
)
from src.modules.subscriptions.models import (
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BetaAccess,
    PaymentMethod,
    Plan,
    Subscription,
)


def _make_user(session: Session) -> User:
    """Create a minimal user for the subscription tables to reference."""
    user = User(
        id=uuid.uuid4(),
        email=f"user-{uuid.uuid4().hex}@example.com",
        password_hash="x",
    )
    session.add(user)
    session.commit()
    return user


def _make_plan(session: Session, code: str = "mensal") -> Plan:
    """Create an active plan at R$ 27.90, the price seeded by the product owner."""
    plan = Plan(code=code, name="Mensal", price=Decimal("27.90"), is_active=True)
    session.add(plan)
    session.commit()
    return plan


def _make_subscription(
    session: Session,
    user: User,
    plan: Plan,
    asaas_subscription_id: str,
    status: str = SUBSCRIPTION_STATUS_ACTIVE,
    **extra,
) -> Subscription:
    """Create a subscription the way checkout does: price taken from the plan (§17.1)."""
    subscription = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        status=status,
        price=plan.price,
        asaas_subscription_id=asaas_subscription_id,
        **extra,
    )
    session.add(subscription)
    return subscription


def test_subscription_tables_exist():
    """The four subscription tables exist in the ORM metadata."""
    assert {"plans", "subscriptions", "payment_methods", "beta_access"} <= set(
        Base.metadata.tables
    )


def test_payments_carries_the_cycle_of_each_charge():
    """`payments` stores the billing month and the card used (rule §17.7)."""
    columns = Payment.__table__.columns
    for name in (
        "subscription_id",
        "cycle_month",
        "paid_at",
        "invoice_url",
        "credit_card_brand",
        "credit_card_last4",
    ):
        assert name in columns, f"payments.{name} ausente"

    assert isinstance(columns["amount"].type, Numeric), (
        "amount deve ser Numeric: dinheiro em Float perde precisão"
    )


def test_plan_rejects_duplicate_code(db_session: Session):
    """The plan code is the business key: two identical rows are an error."""
    _make_plan(db_session, code="mensal")
    db_session.add(Plan(code="mensal", name="Outro", price=Decimal("10.00")))

    with pytest.raises(sqlalchemy.exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_plan_rejects_negative_price(db_session: Session):
    """A negative price is a data-entry error, not a business rule."""
    db_session.add(Plan(code="errado", name="Errado", price=Decimal("-1.00")))

    with pytest.raises(sqlalchemy.exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_only_one_open_subscription_per_user(db_session: Session):
    """A user cannot hold two live subscriptions at once (§17.2)."""
    user = _make_user(db_session)
    plan = _make_plan(db_session)

    _make_subscription(db_session, user, plan, "sub_1")
    db_session.commit()

    _make_subscription(db_session, user, plan, "sub_2")
    with pytest.raises(sqlalchemy.exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_canceled_subscription_does_not_block_a_new_one(db_session: Session):
    """Canceled does not count as live: someone who canceled may subscribe again."""
    user = _make_user(db_session)
    plan = _make_plan(db_session)

    _make_subscription(
        db_session,
        user,
        plan,
        "sub_antiga",
        status=SUBSCRIPTION_STATUS_CANCELED,
        canceled_at=dt.datetime(2026, 10, 1, tzinfo=dt.UTC),
    )
    db_session.commit()

    _make_subscription(db_session, user, plan, "sub_nova")
    db_session.commit()

    open_subscriptions = [
        s
        for s in db_session.query(Subscription).filter(Subscription.user_id == user.id)
        if s.status != SUBSCRIPTION_STATUS_CANCELED
    ]
    assert len(open_subscriptions) == 1
    assert open_subscriptions[0].asaas_subscription_id == "sub_nova"


def test_subscription_rejects_unknown_status(db_session: Session):
    """Status is a closed set: a new value breaks the state machine."""
    user = _make_user(db_session)
    plan = _make_plan(db_session)
    _make_subscription(db_session, user, plan, "sub_3", status="pagamento_pendente")

    with pytest.raises(sqlalchemy.exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_payment_method_never_stores_card_sensitive_data():
    """No card column stores number, CVV or token (rule §17.2).

    The list is explicit on purpose: if someone tomorrow creates `card_number`
    "just to delete it right away", the rule becomes red test code instead of a
    discussion in review.
    """
    forbidden = ("number", "cvv", "cvc", "token", "card_token", "full_number")
    columns = PaymentMethod.__table__.columns

    # `sorted` is not decoration: the column collection has no guaranteed order, and a
    # test that fails on a different column each run says nothing.
    for name in sorted(columns.keys()):
        assert not any(bad in name.lower() for bad in forbidden), (
            f"payment_methods.{name} looks like it stores sensitive card data"
        )


def test_payment_method_keeps_only_displayable_metadata(db_session: Session):
    """The card is stored with only what the screen shows."""
    user = _make_user(db_session)
    db_session.add(
        PaymentMethod(
            user_id=user.id,
            asaas_card_id="card_123",
            brand="VISA",
            last4="8829",
            expiry_month="05",
            expiry_year="2030",
            holder_name="MARCELO ALMEIDA",
            is_default=True,
        )
    )
    db_session.commit()

    method = db_session.query(PaymentMethod).one()
    assert (method.brand, method.last4) == ("VISA", "8829")
    assert method.is_default is True


def test_beta_expiry_is_one_year_after_the_launch_date():
    """One year of beta, counted from the launch date (§17.6)."""
    launch = dt.date(2026, 10, 9)

    assert beta_expiry_from(launch) == dt.date(2027, 10, 9)
    assert (beta_expiry_from(launch) - launch).days == BETA_DURATION_DAYS


def test_beta_expiry_of_february_29_does_not_crash():
    """February 29 has no year that closes on it: it falls back to the 28th."""
    assert beta_expiry_from(dt.date(2028, 2, 29)) == dt.date(2029, 2, 28)


def test_grant_beta_to_all_users_is_idempotent(db_session: Session):
    """Granting beta twice duplicates no row and changes nothing already granted."""
    first = _make_user(db_session)
    second = _make_user(db_session)
    expires_at = dt.datetime(2027, 10, 9, tzinfo=dt.UTC)

    granted = grant_beta_to_all_users(db_session, expires_at=expires_at)
    assert granted == 2

    granted_again = grant_beta_to_all_users(db_session, expires_at=expires_at)
    assert granted_again == 0

    rows = db_session.query(BetaAccess).all()
    assert len(rows) == 2
    assert {row.user_id for row in rows} == {first.id, second.id}
    assert all(row.source == "launch_beta" for row in rows)
    assert all(as_utc(row.expires_at) == expires_at for row in rows)


def test_grant_beta_does_not_move_an_existing_expiry(db_session: Session):
    """Re-running the backfill neither extends nor shortens the beta already granted."""
    user = _make_user(db_session)
    granted_at = dt.datetime(2026, 10, 9, 12, 0, tzinfo=dt.UTC)
    original = dt.datetime(2027, 1, 1, tzinfo=dt.UTC)

    grant_beta_to_all_users(db_session, expires_at=original, granted_at=granted_at)
    grant_beta_to_all_users(
        db_session, expires_at=dt.datetime(2028, 1, 1, tzinfo=dt.UTC)
    )

    row = db_session.query(BetaAccess).filter(BetaAccess.user_id == user.id).one()
    assert as_utc(row.expires_at) == original
    assert as_utc(row.granted_at) == granted_at


def test_grant_beta_skips_users_created_after_the_launch(db_session: Session):
    """A signup after the launch is a new user: it enters as Free (§17.6).

    The backfill runs on launch day and is idempotent, but re-run later it must
    not reach whoever signed up in between — that user was never promised beta.
    """
    launch_moment = dt.datetime(2026, 10, 9, 9, 0, tzinfo=dt.UTC)
    before = _make_user(db_session)
    after = _make_user(db_session)
    db_session.query(User).filter(User.id == after.id).update(
        {User.created_at: launch_moment + dt.timedelta(days=1)}
    )
    db_session.commit()

    granted = grant_beta_to_all_users(
        db_session,
        expires_at=dt.datetime(2027, 10, 9, tzinfo=dt.UTC),
        granted_at=launch_moment,
        registered_until=launch_moment,
    )

    assert granted == 1
    assert (
        db_session.query(BetaAccess).filter(BetaAccess.user_id == before.id).count()
        == 1
    )
    assert (
        db_session.query(BetaAccess).filter(BetaAccess.user_id == after.id).count() == 0
    )


def test_grant_beta_includes_a_user_created_at_the_launch_moment(db_session: Session):
    """The cutoff is inclusive: someone who signed up at the launch instant is beta."""
    launch_moment = dt.datetime(2026, 10, 9, 9, 0, tzinfo=dt.UTC)
    user = _make_user(db_session)
    db_session.query(User).filter(User.id == user.id).update(
        {User.created_at: launch_moment}
    )
    db_session.commit()

    granted = grant_beta_to_all_users(
        db_session,
        expires_at=dt.datetime(2027, 10, 9, tzinfo=dt.UTC),
        granted_at=launch_moment,
        registered_until=launch_moment,
    )

    assert granted == 1


def test_beta_expires_at_is_required(db_session: Session):
    """Beta without an expiry date is eternal beta: the database refuses it."""
    user = _make_user(db_session)
    db_session.add(BetaAccess(user_id=user.id, granted_at=dt.datetime.now(dt.UTC)))

    with pytest.raises(sqlalchemy.exc.IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_past_due_status_is_accepted(db_session: Session):
    """`past_due` is the 3-day grace state and must exist (§17.4)."""
    user = _make_user(db_session)
    plan = _make_plan(db_session)
    _make_subscription(
        db_session,
        user,
        plan,
        "sub_past_due",
        status=SUBSCRIPTION_STATUS_PAST_DUE,
        grace_until=dt.datetime(2026, 11, 3, tzinfo=dt.UTC),
    )
    db_session.commit()

    subscription = db_session.query(Subscription).one()
    assert subscription.status == SUBSCRIPTION_STATUS_PAST_DUE
    assert subscription.grace_until is not None
