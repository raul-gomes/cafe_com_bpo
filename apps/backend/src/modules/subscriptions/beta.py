"""Granting of the one-year launch beta access (§17.6).

Two pieces:

- `beta_expiry_from`: the date the launch promises — one calendar year after the
  launch date, with the February 29 case resolved.
- `grant_beta_to_all_users`: the grant itself, **idempotent**, so it can run on
  launch day without fear of duplicating a row or touching the term of someone
  who already received it.

The command line script (`python -m src.modules.subscriptions.beta --grant`) is
how it runs at launch: the date is decided on the day, so it is not frozen
inside a migration.
"""

import argparse
import datetime as dt
import sys
import uuid
from collections.abc import Sequence

from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from src.core.database import SessionLocal
from src.core.logger import log
from src.modules.auth.models import User
from src.modules.subscriptions.models import BETA_SOURCE_LAUNCH, BetaAccess

# A year in days. Calendar based (365 or 366), so it verifies the calculation
# rather than sourcing it: the expiry date comes from `beta_expiry_from`.
BETA_DURATION_DAYS = 365


def beta_expiry_from(starts_on: dt.date) -> dt.date:
    """Compute the beta expiry: one calendar year after the launch date.

    One year after February 29 does not exist in a non-leap year, so the 29th
    falls back to February 28 — the user never ends up with an expiry on a
    non-existent day nor loses a day of access.

    Args:
        starts_on: Program start date (the launch date).

    Returns:
        The date on which beta access ends.
    """
    try:
        return starts_on.replace(year=starts_on.year + 1)
    except ValueError:
        # February 29 in a non-leap year: step back one day.
        return starts_on.replace(year=starts_on.year + 1, day=28)


def grant_beta_to_all_users(
    session: Session,
    expires_at: dt.datetime,
    source: str = BETA_SOURCE_LAUNCH,
    granted_by: str | None = None,
    granted_at: dt.datetime | None = None,
    registered_until: dt.datetime | None = None,
) -> int:
    """Grant beta to every eligible user that does not have the row yet.

    Idempotent by construction: it only inserts users missing from `beta_access`,
    so re-running neither duplicates a row nor changes the term of someone who
    already received it.

    `registered_until` is what separates "launch beta" from "brand-new user": the
    promise is to whoever **already existed** on the launch date, so the cutoff
    compares the user's `created_at` against that instant (inclusive). Without
    the parameter every user in the table is granted, which is only correct on a
    fresh migration, never on a production backfill re-run later.

    Args:
        session: Database session.
        expires_at: Instant when beta access ends, stored per row.
        source: Grant origin, kept for auditing.
        granted_by: Who granted it (admin email or operation label).
        granted_at: Grant instant; defaults to now, in UTC.
        registered_until: Inclusive `User.created_at` cutoff; `None` grants to
            every user in the table.

    Returns:
        Number of rows created — 0 when everyone already had beta access.
    """
    granted_at = granted_at or dt.datetime.now(dt.UTC)
    existing_user_ids = set(session.scalars(select(BetaAccess.user_id)))
    eligible = select(User.id)
    if registered_until is not None:
        eligible = eligible.where(User.created_at <= registered_until)
    pending = [
        {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "granted_at": granted_at,
            "expires_at": expires_at,
            "source": source,
            "granted_by": granted_by,
        }
        for user_id in session.scalars(eligible)
        if user_id not in existing_user_ids
    ]
    if not pending:
        return 0

    # `on_conflict_do_nothing` closes the race between two simultaneous runs: if
    # the user got beta at the same instant through another path, the ignored
    # insert is the correct outcome, not an error.
    statement = insert(BetaAccess).values(pending)
    if session.bind is not None and session.bind.dialect.name == "postgresql":
        statement = (
            pg_insert(BetaAccess)
            .values(pending)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )
    session.execute(statement)
    session.commit()
    return len(pending)


def _parse_start_date(raw: str) -> dt.date:
    """Convert `YYYY-MM-DD` into a date, rejecting an invalid format.

    Args:
        raw: Text in the ISO date format.

    Returns:
        The matching date.

    Raises:
        argparse.ArgumentTypeError: When the text is not a valid date.
    """
    try:
        return dt.date.fromisoformat(raw)
    except ValueError as error:
        raise argparse.ArgumentTypeError(
            f"invalid date {raw!r}: use the YYYY-MM-DD format"
        ) from error


def _grant_from_cli(starts_on: dt.date) -> int:
    """Run the grant with its own session and log the outcome."""
    with SessionLocal() as session:
        expiry = beta_expiry_from(starts_on)
        granted = grant_beta_to_all_users(
            session,
            expires_at=dt.datetime.combine(expiry, dt.time.min, tzinfo=dt.UTC),
            granted_by="launch",
            # Cutoff at the end of the launch day: someone who signed up during
            # the launch is beta, someone who came later is not. That is what
            # keeps the backfill safe to re-run without turning a brand-new user
            # into beta by accident.
            registered_until=dt.datetime.combine(starts_on, dt.time.max, tzinfo=dt.UTC),
        )
    log.info(
        f"[subscriptions] beta granted to {granted} user(s); "
        f"expires on {expiry.isoformat()}"
    )
    return granted


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point of the beta grant script.

    Usage:
        python -m src.modules.subscriptions.beta --grant --start 2026-10-09

    Returns:
        Process exit code (0 on success).
    """
    parser = argparse.ArgumentParser(
        description="Grants the one-year launch beta access (§17.6).",
    )
    parser.add_argument(
        "--grant",
        action="store_true",
        required=True,
        help="Runs the grant for users without beta.",
    )
    parser.add_argument(
        "--start",
        type=_parse_start_date,
        required=True,
        help="Program start date (YYYY-MM-DD), which is the launch date.",
    )
    args = parser.parse_args(argv)

    if not args.grant:  # pragma: no cover - argparse requires the flag
        parser.error("--grant is required")
    _grant_from_cli(args.start)
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through the CLI
    sys.exit(main())
