"""Access resolution: what a user is allowed to do, derived per request.

There is no `is_paid` column (§2). Access is resolved from the subscription and
the beta grant every time it is needed, because a column can only be as fresh as
the last webhook that wrote it — and the webhook is a third party that retries,
arrives late or never. Deriving the answer removes a whole class of drift: there
is nothing to keep in sync.

The precedence is fixed by §2 and is not negotiable at the call site:

    ADMIN → BETA → ACTIVE → PAST_DUE → FREE

Beta outranks an active subscription on purpose (§17.3): a beta user may
subscribe while the beta runs and is only charged once it ends, so a paying user
inside the beta window is still beta and nothing has been billed yet.

This module reads the subscription models directly, the way the dashboard module
aggregates other modules' data. That is different from a provider adapter (the
Asaas client takes plain values precisely so `core` does not import `modules`):
entitlements is not infrastructure, it is the cross-cutting gate every route
depends on, and it would be a worse place for it than inside one business module.

Two decisions worth stating, because both fail *closed*:

- `current_period_end IS NULL` is not active. The column is written by the
  payment webhook, so it is null in the window between creating a subscription
  and the first `PAYMENT_CONFIRMED`; treating that window as paid would hand out
  the product for free.
- A user with no beta and no subscription is free, and free means read-only
  outside three modules — never "nothing to check yet".
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.time_utils import as_utc
from src.modules.subscriptions.models import (
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BetaAccess,
    Subscription,
)

MODULE_OPERACIONAL = "operacional"
MODULE_COMUNIDADE = "comunidade"
MODULE_GESTAO = "gestao"
MODULE_CAPTAR = "captar"
MODULE_PAGAMENTOS = "pagamentos"

# Stable vocabulary the frontend receives verbatim in `read_only_modules`; a
# rename here is a contract change with the UI.
MODULE_NAMES = (
    MODULE_OPERACIONAL,
    MODULE_COMUNIDADE,
    MODULE_GESTAO,
    MODULE_CAPTAR,
    MODULE_PAGAMENTOS,
)

# §2: a free user may write in these three modules and only read the others.
FREE_WRITABLE_MODULES = (
    MODULE_COMUNIDADE,
    MODULE_OPERACIONAL,
    MODULE_PAGAMENTOS,
)

ROLE_ADMIN = "admin"


class AccessState(StrEnum):
    """The five states of §2, in precedence order."""

    ADMIN = "admin"
    BETA = "beta"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    FREE = "free"


#: States that unlock every module. `past_due` is here because §17.4 gives three
#: days of tolerance before anything is locked.
FULL_ACCESS_STATES = (
    AccessState.ADMIN,
    AccessState.BETA,
    AccessState.ACTIVE,
    AccessState.PAST_DUE,
)


@dataclass(frozen=True)
class PlanSummary:
    """The plan fields the payments screen renders in its call to action."""

    code: str
    name: str
    price: str
    cycle: str


@dataclass(frozen=True)
class Access:
    """The resolved access of one user at one instant.

    Attributes:
        state: One of `AccessState`.
        read_only_modules: Modules where this user may only read.
        expires_at: When the current access ends — the beta expiry for a beta
            user, the paid period end otherwise. `None` for a permanent state
            (admin, free).
        grace_until: End of the dunning tolerance, only for `past_due`.
        plan: The plan behind the access, when there is one.
        subscription_status: Stored status of the subscription, when there is
            one. Useful for the UI to explain *why* (canceled but still paid).
        shows_dunning_banner: True only inside the tolerance window.
    """

    state: AccessState
    read_only_modules: tuple[str, ...]
    expires_at: datetime | None = None
    grace_until: datetime | None = None
    plan: PlanSummary | None = None
    subscription_status: str | None = None
    shows_dunning_banner: bool = False

    @property
    def can_write_everything(self) -> bool:
        """Whether the user may write in every module."""
        return self.state in FULL_ACCESS_STATES

    @property
    def writable_modules(self) -> tuple[str, ...]:
        """Modules where the user may write."""
        if self.can_write_everything:
            return MODULE_NAMES
        return FREE_WRITABLE_MODULES


def resolve_access(
    session: Session,
    user: object,
    *,
    now: datetime,
) -> Access:
    """Resolves the access of a user without storing the result anywhere.

    Args:
        session: Database session.
        user: Authenticated user; anything with `id` and `role` attributes.
        now: Instant to resolve against, in UTC. It is a parameter so a test can
            pin the date instead of depending on the wall clock.

    Returns:
        The user's `Access`.
    """
    if getattr(user, "role", None) == ROLE_ADMIN:
        return Access(state=AccessState.ADMIN, read_only_modules=())

    beta = running_beta(session, user_id=user.id, now=now)
    if beta is not None:
        return Access(
            state=AccessState.BETA,
            read_only_modules=(),
            expires_at=as_utc(beta.expires_at),
        )

    subscription = _best_subscription(session, user_id=user.id, now=now)
    if subscription is None:
        return Access(state=AccessState.FREE, read_only_modules=_read_only_for_free())

    plan = _plan_summary(subscription.plan)
    if subscription.status == SUBSCRIPTION_STATUS_PAST_DUE:
        grace_until = as_utc(subscription.grace_until)
        return Access(
            state=AccessState.PAST_DUE,
            read_only_modules=(),
            expires_at=grace_until,
            grace_until=grace_until,
            plan=plan,
            subscription_status=subscription.status,
            shows_dunning_banner=True,
        )

    period_end = as_utc(subscription.current_period_end)
    if period_end is None or period_end <= now:
        return Access(
            state=AccessState.FREE,
            read_only_modules=_read_only_for_free(),
            plan=plan,
            subscription_status=subscription.status,
        )

    return Access(
        state=AccessState.ACTIVE,
        read_only_modules=(),
        expires_at=period_end,
        plan=plan,
        subscription_status=subscription.status,
    )


def running_beta(
    session: Session, *, user_id: UUID, now: datetime
) -> BetaAccess | None:
    """Returns the beta grant that is still running.

    Public because §17.6 is needed in two places and must not drift: the access
    gate asks "is this person a beta right now", and the checkout asks "when does
    the free year end" to date the first charge after it.

    Args:
        session: Database session.
        user_id: Authenticated user.
        now: Instant to resolve against, in UTC.

    Returns:
        The running grant, or `None` when there is none or it already ended.
    """
    candidates = session.scalars(
        select(BetaAccess).where(BetaAccess.user_id == user_id)
    ).all()
    for beta in candidates:
        expires_at = as_utc(beta.expires_at)
        if expires_at is not None and expires_at > now:
            return beta
    return None


def _best_subscription(
    session: Session, *, user_id: UUID, now: datetime
) -> Subscription | None:
    """Returns the subscription that grants the most access right now.

    A user keeps at most one non-canceled subscription (partial index) but can
    have canceled ones whose paid period has not ended yet, which still grant
    access until it does (§17.6).

    Args:
        session: Database session.
        user_id: Authenticated user.
        now: Instant to resolve against, in UTC.

    Returns:
        The granting subscription, or `None` when none of them grants anything.
    """
    subscriptions = session.scalars(
        select(Subscription).where(Subscription.user_id == user_id)
    ).all()

    past_due: Subscription | None = None
    for subscription in subscriptions:
        if subscription.status == SUBSCRIPTION_STATUS_PAST_DUE:
            grace_until = as_utc(subscription.grace_until)
            if grace_until is not None and grace_until > now:
                past_due = past_due or subscription
            continue
        if subscription.status not in (
            SUBSCRIPTION_STATUS_ACTIVE,
            SUBSCRIPTION_STATUS_CANCELED,
        ):
            # `incomplete` (checkout started, nothing confirmed) grants nothing.
            continue
        period_end = as_utc(subscription.current_period_end)
        if period_end is not None and period_end > now:
            return subscription
    return past_due


def _plan_summary(plan: object) -> PlanSummary | None:
    """Adapts a `Plan` row to the fields the screen renders.

    Args:
        plan: Related plan, or `None` when the relationship is not loaded.

    Returns:
        The plan summary, or `None` when there is no plan.
    """
    if plan is None:
        return None
    return PlanSummary(
        code=plan.code,
        name=plan.name,
        price=str(plan.price),
        cycle=plan.cycle,
    )


def _read_only_for_free() -> tuple[str, ...]:
    """Returns the modules a free user cannot write.

    Returns:
        Module names, sorted for a stable payload.
    """
    return tuple(sorted(set(MODULE_NAMES) - set(FREE_WRITABLE_MODULES)))
