"""Migration-safety guard for the R2 foreign-key backfill.

`backfill_company_fks` runs inside revision `e5f6a7b8c9d0`, but it reads the ORM
models, and the models always describe **head**. As soon as a later revision adds
a column — R3 gave `teams`, `client_slas` and `client_template_assignments` their
`is_active`/`deleted_at` — the backfill started selecting columns that do not
exist yet at that point of the chain, and the migration died with
`column teams.is_active does not exist`. The rehearsal in
`tests/integration/test_migrations_postgres.py` caught it; this test keeps the
default suite honest about it, because it needs no PostgreSQL and runs in a
second.

The invariant: running the backfill must never select a column outside
`BACKFILL_COLUMNS` — the only ones guaranteed to exist when R2 runs.
"""

import re

import pytest

from src.modules.companies.fk_backfill import (
    BACKFILL_COLUMNS,
    LEGACY_OWNED,
    backfill_company_fks,
)

# A table name followed by one of its columns, as SQLAlchemy renders it.
QUALIFIED_COLUMN = re.compile(r"\b(\w+)\.(\w+)")


@pytest.fixture
def backfill_statements(db_session) -> list[str]:
    """Runs the backfill with SQL capture on and returns what it issued.

    Args:
        db_session: The test session; the backfill runs inside it.

    Returns:
        Every statement executed against the database during the backfill.
    """
    from sqlalchemy import event

    captured: list[str] = []

    def _record(conn, cursor, statement, parameters, context, executemany):
        captured.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", _record)
    try:
        backfill_company_fks(db_session)
    finally:
        event.remove(engine, "before_cursor_execute", _record)
    return captured


@pytest.mark.parametrize("model,follows_conversion", LEGACY_OWNED)
def test_backfill_never_selects_a_column_added_after_r2(
    model, follows_conversion, backfill_statements: list[str]
) -> None:
    """The backfill reads only what R2 can count on existing.

    Args:
        model: The child table model under test.
        follows_conversion: Part of the `LEGACY_OWNED` tuple shape, unused here.
        backfill_statements: The statements the backfill issued.
    """
    table = model.__tablename__
    forbidden = {
        column.key
        for column in model.__table__.columns
        if column.key not in BACKFILL_COLUMNS
    }
    assert forbidden, (
        f"{table} declares {sorted(forbidden)}, which the guard cannot see: the "
        "test would pass no matter what the backfill selects"
    )

    selected: set[str] = set()
    for statement in backfill_statements:
        for qualifier, column in QUALIFIED_COLUMN.findall(statement):
            if qualifier == table:
                selected.add(column)

    leaked = selected & forbidden
    assert not leaked, (
        f"the backfill selected {sorted(leaked)} from {table}; those columns are "
        "added by a revision that runs after R2, so the migration fails with "
        '"column does not exist" in production'
    )
    assert selected, f"the guard did not observe any SQL against {table}"
