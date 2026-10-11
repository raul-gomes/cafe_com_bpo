"""Beta expiry notices — the daily scan behind D12 and §17.6.

One job, one rule: each running beta gets the 30-day notice and, later, the
7-day notice, **once per user and per type**. The dedupe lives in the e-mail
queue (`email_deliveries.idempotency_key`, unique), so a re-run of the job —
or a job that runs twice for any reason — counts rows as `skipped` instead of
sending again.

The scan prefers the *late* notice: a user first seen with 6 days left gets the
7-day mail only, never a back-to-back pair where a "30 days" warning arrives
with less than a week to act. Admins are excluded (D11): nothing changes for
them when the beta ends, so the warning would be false — the same reason the
panel banner can never show in the admin state.

The window and the banner share `BETA_BANNER_WINDOW_DAYS`, so the e-mail and
the panel always agree on when the warning starts.
"""

from datetime import UTC, datetime, timedelta
from typing import NamedTuple

from src.core.database import SessionLocal
from src.core.email import EmailService
from src.core.entitlements import BETA_BANNER_WINDOW_DAYS, ROLE_ADMIN
from src.core.logger import log
from src.core.time_utils import as_utc, days_until
from src.modules.auth.models import User
from src.modules.emails.repository import EmailDeliveryRepository
from src.modules.subscriptions.models import BetaAccess

BETA_NOTICE_KIND = "beta_notice"

# The scan asks the database for one extra day of slack and filters by calendar
# day afterwards, so a grant whose expiry falls where the clock landed is never
# missed by the range predicate.
_QUERY_SLACK_DAYS = BETA_BANNER_WINDOW_DAYS + 1

# Inside this many days the late notice replaces the early one.
_LATE_WINDOW_DAYS = 7


class BetaNoticeResult(NamedTuple):
    """Counters of one scan run.

    Attributes:
        enqueued: Notices queued in this run.
        skipped: Users already queued for the notice they are due (dedupe hit).
    """

    enqueued: int
    skipped: int


def run_beta_notices(*, now: datetime | None = None) -> BetaNoticeResult:
    """Queues the beta-expiry notice each running beta is due (§17.6).

    Args:
        now: Instant to scan against; defaults to the current UTC time. Tests
            pass it explicitly so the suite never reads the wall clock.

    Returns:
        How many notices were queued and how many were deduplicated.
    """
    if now is None:
        now = datetime.now(UTC)

    session = SessionLocal()
    try:
        repo = EmailDeliveryRepository(session)
        rows = (
            session.query(BetaAccess, User)
            .join(User, User.id == BetaAccess.user_id)
            .filter(
                BetaAccess.expires_at > now,
                BetaAccess.expires_at <= now + timedelta(days=_QUERY_SLACK_DAYS),
                User.role != ROLE_ADMIN,
            )
            .all()
        )

        enqueued = 0
        skipped = 0
        for beta, user in rows:
            days_left = days_until(beta.expires_at, now)
            if days_left < 0 or days_left > BETA_BANNER_WINDOW_DAYS:
                continue

            notice_type = "7d" if days_left <= _LATE_WINDOW_DAYS else "30d"
            key = f"{BETA_NOTICE_KIND}:{user.id}:{notice_type}"
            if repo.get_by_idempotency_key(key) is not None:
                skipped += 1
                continue

            EmailService.send_beta_notice_email(
                user.email,
                user_id=str(user.id),
                notice_type=notice_type,
                expiry_date=_format_expiry(beta.expires_at),
            )
            enqueued += 1

        if enqueued or skipped:
            log.info(f"📩 Beta notices: {enqueued} queued, {skipped} already sent")
        return BetaNoticeResult(enqueued=enqueued, skipped=skipped)
    finally:
        session.close()


def _format_expiry(value: datetime) -> str:
    """Formats a beta expiry for the e-mail body as DD/MM/YYYY.

    Args:
        value: The `beta_access.expires_at` instant.

    Returns:
        The UTC date of the expiry — the same instant access resolution
        compares, so the e-mail and the panel never name different days.
    """
    return as_utc(value).strftime("%d/%m/%Y")
