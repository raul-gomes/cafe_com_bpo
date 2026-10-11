"""Instant normalization between Postgres and SQLite (`src/core/time_utils`).

The point is not the helper itself: it is that the same comparison
(`grace_until > now()`) must answer the same in tests and in production, and the
two databases hand back the instant in different shapes.
"""

import datetime as dt

from src.core.time_utils import as_utc, days_until


def test_naive_datetime_is_read_as_utc():
    """SQLite hands it back naive; the project convention says that is UTC."""
    naive = dt.datetime(2026, 11, 3, 12, 0, 0)

    assert as_utc(naive) == dt.datetime(2026, 11, 3, 12, 0, 0, tzinfo=dt.UTC)


def test_aware_datetime_is_converted_to_utc():
    """An instant with a timezone is converted, never reinterpreted."""
    aware = dt.datetime(
        2026, 11, 3, 12, 0, 0, tzinfo=dt.timezone(dt.timedelta(hours=-3))
    )

    converted = as_utc(aware)

    assert converted == dt.datetime(2026, 11, 3, 15, 0, 0, tzinfo=dt.UTC)
    assert converted.tzinfo is dt.UTC


def test_none_stays_none():
    """An empty column stays empty — it never becomes "epoch" nor an error."""
    assert as_utc(None) is None


def test_comparison_works_for_both_database_dialects():
    """The same instant written by both databases compares equal."""
    instant = dt.datetime(2026, 11, 3, 12, 0, 0, tzinfo=dt.UTC)
    from_postgres = instant
    from_sqlite = instant.replace(tzinfo=None)

    assert as_utc(from_postgres) > as_utc(dt.datetime(2026, 11, 1, tzinfo=dt.UTC))
    assert as_utc(from_sqlite) > as_utc(dt.datetime(2026, 11, 1))


def test_days_until_counts_whole_calendar_days():
    """The beta notices are labeled by calendar day, not by elapsed hours."""
    now = dt.datetime(2026, 10, 5, 12, 0, tzinfo=dt.UTC)
    target = dt.datetime(2026, 11, 4, 0, 0, tzinfo=dt.UTC)

    assert days_until(target, now) == 30


def test_days_until_is_negative_for_the_past():
    """An expired target reads as a negative count, never as a huge positive."""
    now = dt.datetime(2026, 10, 5, 12, 0, tzinfo=dt.UTC)
    target = dt.datetime(2026, 9, 5, 12, 0, tzinfo=dt.UTC)

    assert days_until(target, now) == -30


def test_days_until_accepts_naive_values_from_sqlite():
    """Both sides go through `as_utc` before the date subtraction."""
    now = dt.datetime(2026, 10, 5, 12, 0)
    target = dt.datetime(2026, 10, 7, 0, 0)

    assert days_until(target, now) == 2
