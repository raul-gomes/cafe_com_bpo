"""Access resolution: what a user is allowed to do, derived per request.

There is no `is_paid` column (§2). Access is resolved from the subscription and
the beta grant every time it is needed, because a column can only be as fresh as
the last webhook that wrote it — and the webhook is a third party that retries,
arrives late or never. Deriving the answer removes a whole class of drift: there
is nothing to keep in sync.

The precedence is fixed by §2 and is not negotiable at the call site:

    ADMIN → BETA → COURTESY → ACTIVE → PAST_DUE → FREE

Beta outranks an active subscription on purpose (§17.3): a beta user may
subscribe while the beta runs and is only charged once it ends, so a paying user
inside the beta window is still beta and nothing has been billed yet.

A courtesy is free full access an administrator grants for a period (partners,
supporters, support cases). It sits right after beta: both are "free full
access until a date", and neither involves the payment provider.

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
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.core.security import oauth2_scheme
from src.core.time_utils import as_utc, days_until
from src.modules.auth.service import get_current_user
from src.modules.subscriptions.models import (
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BetaAccess,
    CourtesyGrant,
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

# D12: how long before `beta_access.expires_at` the warning is shown — the same
# window for the panel banner (`shows_beta_banner`) and for the e-mail notices
# (`subscriptions/beta_notice.py`), so the two never disagree.
BETA_BANNER_WINDOW_DAYS = 30


class AccessState(StrEnum):
    """The states of §2 (plus courtesy), in precedence order."""

    ADMIN = "admin"
    BETA = "beta"
    COURTESY = "courtesy"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    FREE = "free"


#: States that unlock every module. `past_due` is here because §17.4 gives three
#: days of tolerance before anything is locked.
FULL_ACCESS_STATES = (
    AccessState.ADMIN,
    AccessState.BETA,
    AccessState.COURTESY,
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
        shows_beta_banner: True while a running beta is within
            `BETA_BANNER_WINDOW_DAYS` of expiring (D12); the flag that drives
            the in-panel warning. Never true outside the `BETA` state.
    """

    state: AccessState
    read_only_modules: tuple[str, ...]
    expires_at: datetime | None = None
    grace_until: datetime | None = None
    plan: PlanSummary | None = None
    subscription_status: str | None = None
    shows_dunning_banner: bool = False
    shows_beta_banner: bool = False

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
        days_left = days_until(beta.expires_at, now)
        return Access(
            state=AccessState.BETA,
            read_only_modules=(),
            expires_at=as_utc(beta.expires_at),
            shows_beta_banner=0 <= days_left <= BETA_BANNER_WINDOW_DAYS,
        )

    courtesy = running_courtesy(session, user_id=user.id, now=now)
    if courtesy is not None:
        return Access(
            state=AccessState.COURTESY,
            read_only_modules=(),
            expires_at=as_utc(courtesy.expires_at),
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


def running_courtesy(
    session: Session, *, user_id: UUID, now: datetime
) -> CourtesyGrant | None:
    """Returns the courtesy grant that is still running, if any.

    Args:
        session: Database session.
        user_id: User to check.
        now: Instant to resolve against, in UTC.

    Returns:
        The running grant that lasts the longest, or `None`.
    """
    grants = session.scalars(
        select(CourtesyGrant).where(
            CourtesyGrant.user_id == user_id, CourtesyGrant.revoked_at.is_(None)
        )
    ).all()
    running = [g for g in grants if (as_utc(g.expires_at) or now) > now]
    return max(running, key=lambda g: as_utc(g.expires_at), default=None)


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


# ---------------------------------------------------------------------------
# Write gate (§4 of the payments plan, Fase 6)
# ---------------------------------------------------------------------------

#: Internal label for routes that are never gated. Deliberately outside
#: `MODULE_NAMES`: it is not part of the §2 vocabulary the UI renders.
MODULE_PLATAFORMA = "plataforma"

#: The gate's 403 message, shown by the frontend in the upgrade toast.
WRITE_FORBIDDEN_DETAIL = "Seu plano não permite esta ação"

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

#: Prefixes of §4 classified as the always-gated-by-nobody platform rows.
_PLATAFORMA_PREFIXES = (
    "/auth",
    "/dashboard",
    "/notifications",
    "/feedback",
    "/webhooks",
    "/pricing",
    "/plans",
    # Public Beta signup on the landing page (anonymous, rate limited) and the
    # admin-only list: neither depends on the user's plan.
    "/beta",
    # Administrator tools and the content they publish (lessons, announcements,
    # site settings) plus the public café confirmation: none depends on a plan.
    "/admin",
    "/lessons",
    "/announcements",
    "/site",
    "/cafes",
)


@dataclass(frozen=True)
class RouteRule:
    """The §4 rule attached to a route path.

    Attributes:
        module: One of `MODULE_NAMES`, or `MODULE_PLATAFORMA` for the routes
            that are never gated.
        free_writable: Whether a free user may write here even though the
            module is otherwise read-only for them (§4 exceptions).
        always_allowed: Whether the route bypasses the gate entirely — the
            platform rows of §4 and the signature-authenticated webhooks.
    """

    module: str
    free_writable: bool = False
    always_allowed: bool = False


def _under(path: str, prefix: str) -> bool:
    """Whether `path` is `prefix` or lives below it.

    Args:
        path: Route path from the request or from openapi.
        prefix: Classified prefix of §4.

    Returns:
        True when the path equals the prefix or starts with `prefix/`, so a
        path template like `/tasks/{task_id}` matches the `/tasks` row.
    """
    return path == prefix or path.startswith(prefix + "/")


def _network_rule(path: str) -> RouteRule:
    """Classifies a route under `/network`, the mixed router of §4.

    The endpoint map of §4 splits the router: the forum routes (posts, comments
    and skills) are comunidade, everything else (projects, invites,
    applications, conversations, groups, member and profile comments) is gestão.
    Anything unknown under `/network` defaults to gestão — read-only for free
    users — so a new endpoint fails closed instead of silently opening a module.

    Args:
        path: Route path under `/network`.

    Returns:
        The comunidade rule for the forum, the gestao rule otherwise.
    """
    for prefix in (
        "/network/posts",
        "/network/comments",
        "/network/me/skills",
        "/network/skills",
    ):
        if _under(path, prefix):
            return RouteRule(MODULE_COMUNIDADE)
    return RouteRule(MODULE_GESTAO)


def classify_route(path: str) -> RouteRule | None:
    """Maps a route path to its §4 rule, or `None` when it matches nothing.

    Order matters: the always-allowed sets and the free-writable exceptions are
    checked before the prefix table, because a path can match several rows
    (`/payments/webhook` is below `/payments` but must never be gated).

    Args:
        path: Route path from the request or from openapi.

    Returns:
        The matching `RouteRule`, or `None` for an unclassified path; the gate
        fails closed on those.
    """
    always = RouteRule(MODULE_PLATAFORMA, always_allowed=True)
    for prefix in _PLATAFORMA_PREFIXES:
        if _under(path, prefix):
            return always
    if path == "/payments/webhook":
        return always
    if _under(path, "/invitations") and path.endswith(("/accept", "/decline")):
        return RouteRule(MODULE_GESTAO, free_writable=True)
    if _under(path, "/proposals/public"):
        return RouteRule(MODULE_CAPTAR, free_writable=True)
    if _under(path, "/network"):
        return _network_rule(path)
    for prefix, module in _MODULE_PREFIXES:
        if _under(path, prefix):
            return RouteRule(module)
    return None


#: The §4 prefix table: each row decides the module of a family of routes.
#: Deliberately a tuple so the openapi completeness test walks the same rules
#: the gate enforces.
_MODULE_PREFIXES = (
    ("/tasks", MODULE_OPERACIONAL),
    ("/clients", MODULE_OPERACIONAL),
    ("/calendar", MODULE_OPERACIONAL),
    ("/gallery", MODULE_COMUNIDADE),
    ("/contacts", MODULE_GESTAO),
    ("/team", MODULE_GESTAO),
    ("/invitations", MODULE_GESTAO),
    ("/payments", MODULE_PAGAMENTOS),
    ("/subscriptions", MODULE_PAGAMENTOS),
    ("/access", MODULE_PAGAMENTOS),
    ("/proposals", MODULE_CAPTAR),
    ("/prospects", MODULE_CAPTAR),
    ("/contracts", MODULE_CAPTAR),
    ("/governanca", MODULE_CAPTAR),
)


def write_gate(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    session: Session = Depends(get_db_session),
) -> None:
    """Enforces §4 before every route: a free user may only write in three modules.

    Safe methods always pass. A mutating route is classified first; a path with
    no rule fails closed with the gate's 403, so a new endpoint can never open a
    hole silently. Platform rows and the signature-authenticated webhooks
    bypass the gate. Without a token the gate stays out of the way — the route's
    own authentication answers 401. With a token, access is resolved (§2) and
    the write is allowed for the full-access states and for the free-writable
    modules and exceptions of §4.

    Args:
        request: Incoming request.
        token: Bearer token, or `None` when absent (`auto_error=False`).
        session: Database session.

    Raises:
        HTTPException: 403 when the route is gated and the user may not write.
    """
    if request.method in SAFE_METHODS:
        return
    rule = classify_route(request.url.path)
    if rule is None:
        log.error(
            "Write gate: unclassified mutating route rejected",
            extra={"method": request.method, "path": request.url.path},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=WRITE_FORBIDDEN_DETAIL
        )
    if rule.always_allowed:
        return
    if token is None:
        return
    user = get_current_user(token, session)
    access = resolve_access(session, user, now=datetime.now(UTC))
    if access.can_write_everything:
        return
    if rule.free_writable or rule.module in FREE_WRITABLE_MODULES:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, detail=WRITE_FORBIDDEN_DETAIL
    )
