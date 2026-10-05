"""Instant normalization between Postgres and SQLite.

The production database (Postgres) returns timezone-aware `datetime` values; the
SQLite used by the tests returns them **without** a timezone. Comparing the two
directly makes `grace_until > now()` answer differently in tests and in
production — the worst class of bug: green on CI, broken on the server.

Project rule: every instant stored is UTC. `as_utc` is the boundary that applies
that rule on read, so the rest of the code only ever compares UTC values.
"""

import datetime as dt


def as_utc(value: dt.datetime | None) -> dt.datetime | None:
    """Normalize an instant read from the database to UTC.

    Naive values are treated as UTC, since that is the project storage convention
    (and what Postgres returns for `timezone=True` columns).

    Args:
        value: Instant read from the database, with or without a timezone, or
            `None`.

    Returns:
        The same instant in UTC, or `None` when the input is `None`.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.UTC)
    return value.astimezone(dt.UTC)
