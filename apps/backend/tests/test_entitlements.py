"""Access resolution — the single source of truth for "what can this user do?".

The plan (§2) forbids an `is_paid` column: access is derived per request, so it
cannot drift from the subscription that paid for it. These tests pin the
precedence (admin, beta, active, past_due, free) and the two rules that are easy
to get wrong:

- **Beta outranks an active subscription.** §17.3: a beta user may subscribe and
  is only charged once the beta ends, so a paid user inside the beta window must
  still resolve as beta (full access, nothing billed yet).
- **`current_period_end` IS NULL resolves to free.** The column is written by the
  webhook, so before the first `PAYMENT_CONFIRMED` it is null for every
  subscription. Failing open there would hand full access to a subscription that
  nobody ever paid for — the cost is the whole product.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from src.core.entitlements import (
    MODULE_NAMES,
    AccessState,
    resolve_access,
)
from src.modules.subscriptions.beta import grant_beta_to_all_users
from src.modules.subscriptions.models import (
    SUBSCRIPTION_CYCLE_MONTHLY,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BetaAccess,
    Plan,
    Subscription,
)
from tests.helpers import create_test_user

NOW = datetime(2026, 10, 13, 12, 0, tzinfo=UTC)


def _user(db_session, role: str = "user"):
    """Creates a user with the given role.

    Args:
        db_session: Test database session.
        role: `user` or `admin`.

    Returns:
        The persisted user.
    """
    from src.modules.auth.models import User

    email = f"acc_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role=role)
    # Re-read in the test session: `create_test_user` returns an instance whose
    # session is already closed, and reading its attributes would raise.
    return db_session.query(User).filter_by(email=email).one()


def _plan(db_session) -> Plan:
    """Creates the monthly plan.

    Args:
        db_session: Test database session.

    Returns:
        The persisted plan.
    """
    plan = Plan(
        id=uuid4(),
        code="monthly",
        name="Mensal",
        price="27.90",
        cycle=SUBSCRIPTION_CYCLE_MONTHLY,
        is_active=True,
    )
    db_session.add(plan)
    db_session.commit()
    return plan


def _subscription(db_session, user_id, **overrides) -> Subscription:
    """Creates a subscription with sensible defaults.

    Args:
        db_session: Test database session.
        user_id: Owner of the subscription.
        **overrides: Fields to replace (`period_end_in`, `grace_in`, `status`).

    Returns:
        The persisted subscription.
    """
    period_end_in = overrides.pop("period_end_in", timedelta(days=10))
    grace_in = overrides.pop("grace_in", timedelta(days=3))
    fields = {
        "id": uuid4(),
        "user_id": user_id,
        "plan_id": _plan(db_session).id,
        "status": SUBSCRIPTION_STATUS_ACTIVE,
        "cycle": SUBSCRIPTION_CYCLE_MONTHLY,
        "price": "27.90",
        "current_period_start": NOW - timedelta(days=20),
        "current_period_end": NOW + period_end_in if period_end_in else None,
        "grace_until": NOW + grace_in if grace_in else None,
        "asaas_subscription_id": f"sub_{uuid4().hex[:8]}",
        "price_sync_status": "synced",
    }
    fields.update(overrides)
    subscription = Subscription(**fields)
    db_session.add(subscription)
    db_session.commit()
    return subscription


def _beta(db_session, user_id, *, expires_in: timedelta):
    """Creates a beta grant.

    Args:
        db_session: Test database session.
        user_id: Owner of the grant.
        expires_in: How far from `NOW` the beta expires.

    Returns:
        The persisted beta row.
    """
    beta = BetaAccess(
        id=uuid4(),
        user_id=user_id,
        expires_at=NOW + expires_in,
        source="launch_beta",
    )
    db_session.add(beta)
    db_session.commit()
    return beta


def test_admin_always_resolves_to_full_access(db_session):
    """D11: an admin is never locked out by a missing payment."""
    user = _user(db_session, role="admin")

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.ADMIN
    assert access.read_only_modules == ()
    assert access.can_write_everything


def test_free_user_writes_only_in_three_modules(db_session):
    """A user with no beta and no subscription is read-only outside three modules."""
    user = _user(db_session)

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.FREE
    assert set(access.read_only_modules) == {"captar", "gestao"}
    assert access.writable_modules == ("comunidade", "operacional", "pagamentos")


def test_beta_before_expiry_is_full_access(db_session):
    """D9: beta gives full access without any charge."""
    user = _user(db_session)
    _beta(db_session, user.id, expires_in=timedelta(days=200))

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.BETA
    assert access.read_only_modules == ()
    assert access.expires_at == NOW + timedelta(days=200)


def test_beta_banner_shows_on_the_thirtieth_day(db_session):
    """D12: the panel warns while there are still 30 days left to act."""
    user = _user(db_session)
    _beta(db_session, user.id, expires_in=timedelta(days=30))

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.BETA
    assert access.shows_beta_banner is True


def test_beta_banner_stays_hidden_outside_the_window(db_session):
    """31 days out there is nothing to warn about yet."""
    user = _user(db_session)
    _beta(db_session, user.id, expires_in=timedelta(days=31))

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.BETA
    assert access.shows_beta_banner is False


def test_beta_outranks_an_active_subscription(db_session):
    """A beta user who subscribed is only charged after the beta ends (§17.3)."""
    user = _user(db_session)
    _subscription(db_session, user.id)
    _beta(db_session, user.id, expires_in=timedelta(days=200))

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.BETA


def test_expired_beta_falls_through_to_the_active_subscription(db_session):
    """When the beta ends, the paid subscription takes over instead of a downgrade."""
    user = _user(db_session)
    _subscription(db_session, user.id)
    _beta(db_session, user.id, expires_in=timedelta(days=-1))

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.ACTIVE
    assert access.expires_at == NOW + timedelta(days=10)


def test_active_requires_a_period_end_in_the_future(db_session):
    """§2: an ended period is not active, whatever the status column says."""
    user = _user(db_session)
    _subscription(db_session, user.id, period_end_in=timedelta(seconds=-1))

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.FREE


def test_subscription_without_a_period_end_is_not_active(db_session):
    """A subscription nobody paid for yet must not grant anything.

    `current_period_end` is only written by the payment webhook, so the window
    between creating the subscription and the first `PAYMENT_CONFIRMED` has it
    null. Resolving that as active would be full access for free.

    Args:
        db_session: Test database session.
    """
    user = _user(db_session)
    _subscription(db_session, user.id, period_end_in=None)

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.FREE


def test_past_due_inside_the_grace_window_keeps_full_access(db_session):
    """§17.4: three days of tolerance, with the banner."""
    user = _user(db_session)
    _subscription(
        db_session,
        user.id,
        status=SUBSCRIPTION_STATUS_PAST_DUE,
        grace_in=timedelta(days=2),
    )

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.PAST_DUE
    assert access.read_only_modules == ()
    assert access.grace_until == NOW + timedelta(days=2)
    assert access.shows_dunning_banner


def test_past_due_after_the_grace_window_is_free(db_session):
    """After the tolerance expires the plan stops, and the data stays."""
    user = _user(db_session)
    _subscription(
        db_session,
        user.id,
        status=SUBSCRIPTION_STATUS_PAST_DUE,
        grace_in=timedelta(days=-1),
    )

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.FREE
    assert set(access.read_only_modules) == {"captar", "gestao"}


def test_canceled_subscription_keeps_the_paid_period(db_session):
    """§17.6: cancelling stops future charges, not the month already paid."""
    user = _user(db_session)
    _subscription(db_session, user.id, status="canceled")

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.ACTIVE


def test_launch_grant_resolves_to_beta(db_session):
    """A beta granted by the launch command behaves like any other beta."""
    user = _user(db_session)
    grant_beta_to_all_users(
        db_session,
        expires_at=NOW + timedelta(days=365),
        registered_until=NOW,
        granted_at=NOW,
    )

    access = resolve_access(db_session, user, now=NOW)

    assert access.state is AccessState.BETA


def test_module_names_are_the_ones_the_gate_speaks(db_session):
    """The frontend receives these names verbatim in `read_only_modules`."""
    assert MODULE_NAMES == (
        "operacional",
        "comunidade",
        "gestao",
        "captar",
        "pagamentos",
    )
