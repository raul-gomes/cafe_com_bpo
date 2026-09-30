"""Regressions of the R2 migration (`e5f6a7b8c9d0`, company_id on child tables).

The migration itself needs PostgreSQL, so these tests do not run it against a
database: they call `upgrade()`/`downgrade()` with a recording stub in place of
`alembic.op` and assert the sequence of schema operations. That is enough to
lock the two things that broke production readiness:

- the double `drop_index("ix_teams_company_id")` in the downgrade (the explicit
  drop plus the `CLIENT_ONLY_TABLES` loop), which made `alembic downgrade` raise
  on a database that had actually been upgraded;
- the schema asymmetry between what the migration creates and what the models
  declare, which silently makes a later `alembic revision --autogenerate`
  propose dropping and recreating constraints that already exist.
"""

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import CheckConstraint, ForeignKeyConstraint

R2_REVISION = "e5f6a7b8c9d0"
R2_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "e5f6a7b8c9d0_add_company_id_to_child_tables.py"
)

CLIENT_ONLY_TABLES = ("tasks", "teams", "client_slas", "client_template_assignments")
ANY_TYPE_TABLES = ("pricing_scenarios", "contracts")


class OpRecorder:
    """Stand-in for `alembic.op` that records every schema operation.

    `drop_index` also checks the index still exists, the way PostgreSQL does:
    dropping the same index twice raises, which is exactly the failure this
    suite exists to catch.
    """

    def __init__(self) -> None:
        """Starts with no operation and no index created."""
        self.calls: list[tuple] = []
        self.live_indexes: set[str] = set()
        self.live_constraints: set[str] = set()
        self.live_columns: set[tuple[str, str]] = set()

    def _record(self, *args) -> None:
        self.calls.append(args)

    def add_column(self, table: str, column) -> None:
        """Registers a new column on `table`."""
        self._record("add_column", table, column.name)
        self.live_columns.add((table, column.name))

    def create_index(
        self, name: str, table: str, columns, unique: bool = False
    ) -> None:
        """Registers an index; a duplicate name is a PostgreSQL error."""
        if name in self.live_indexes:
            raise RuntimeError(f'relation "{name}" already exists')
        self._record("create_index", name, table, tuple(columns), unique)
        self.live_indexes.add(name)

    def drop_index(self, name: str, table_name: str | None = None) -> None:
        """Drops an index; dropping a missing one is a PostgreSQL error."""
        if name not in self.live_indexes:
            raise RuntimeError(f'index "{name}" does not exist')
        self._record("drop_index", name, table_name)
        self.live_indexes.discard(name)

    def create_foreign_key(
        self, name: str, source: str, target: str, local, remote, **kw
    ):
        """Registers a foreign key constraint."""
        self._record("create_foreign_key", name, source, target, kw.get("ondelete"))
        self.live_constraints.add(name)

    def drop_constraint(self, name: str, table: str, type_: str | None = None) -> None:
        """Drops a constraint; dropping a missing one is a PostgreSQL error."""
        if name not in self.live_constraints:
            raise RuntimeError(f'constraint "{name}" does not exist')
        self._record("drop_constraint", name, table, type_)
        self.live_constraints.discard(name)

    def create_check_constraint(self, name: str, table: str, condition: str) -> None:
        """Registers a check constraint."""
        self._record("create_check_constraint", name, table, condition)
        self.live_constraints.add(name)

    def drop_check_constraint(self, name: str, table: str) -> None:
        """Drops a check constraint; dropping a missing one is an error."""
        if name not in self.live_constraints:
            raise RuntimeError(f'constraint "{name}" does not exist')
        self._record("drop_check_constraint", name, table)
        self.live_constraints.discard(name)

    def drop_column(self, table: str, column: str) -> None:
        """Drops a column and forgets it."""
        self._record("drop_column", table, column)
        self.live_columns.discard((table, column))

    def get_bind(self):
        """Opaque handle: the test stubs out `Session`, so it is never used."""
        return object()


@pytest.fixture
def r2(monkeypatch):
    """Loads the R2 migration file with `op` and the backfill stubbed out.

    Alembic's version directory is not a Python package (no `__init__.py`), so
    the file is loaded by path instead of by dotted import.
    """
    spec = importlib.util.spec_from_file_location(f"_r2_{R2_REVISION}", R2_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    recorder = OpRecorder()
    monkeypatch.setattr(module, "op", recorder, raising=True)

    class FakeSession:
        """Stand-in for the SQLAlchemy session used by the backfill."""

        def commit(self) -> None:
            """The stub commits nothing."""

    class FakeReport:
        """Stand-in for the backfill report."""

        def as_dict(self) -> dict:
            """Empty report: the real backfill has its own test module."""
            return {}

    monkeypatch.setattr(
        "src.modules.companies.fk_backfill.backfill_company_fks",
        lambda session: FakeReport(),
    )
    monkeypatch.setattr(module, "Session", lambda bind: FakeSession())
    return module, recorder


def test_downgrade_drops_each_index_exactly_once(r2):
    """Rule: `alembic downgrade` must run on a database upgraded by R2.

    The bug: line 90 dropped `ix_teams_company_id` explicitly and the
    `CLIENT_ONLY_TABLES` loop dropped it again for `teams`, so the downgrade
    raised `index "ix_teams_company_id" does not exist` halfway through, leaving
    `teams` with `company_type` and `company_id` still in place.
    """
    module, recorder = r2

    module.upgrade()
    recorder.calls.clear()

    module.downgrade()

    dropped = [
        name for call in recorder.calls if call[0] == "drop_index" for name in [call[1]]
    ]
    assert len(dropped) == len(set(dropped)), f"index dropped twice: {dropped}"
    assert set(dropped) == {
        "ix_teams_company_id",
        *(f"ix_{table}_company_id" for table in CLIENT_ONLY_TABLES if table != "teams"),
        *(f"ix_{table}_company_id" for table in ANY_TYPE_TABLES),
    }
    assert not recorder.live_indexes
    assert not recorder.live_columns
    assert not recorder.live_constraints


def test_downgrade_then_upgrade_round_trip(r2):
    """Rule: a database can go R2 -> back and return without leftovers.

    The rehearsable path the runbook asks for: upgrade, downgrade, upgrade
    again. Re-upgrading must not hit a "relation already exists" error, which is
    what happens when the downgrade leaves an index or a constraint behind.
    """
    module, recorder = r2

    module.upgrade()
    module.downgrade()
    module.upgrade()

    assert len(recorder.live_indexes) == len(CLIENT_ONLY_TABLES) - 1 + 1 + len(
        ANY_TYPE_TABLES
    )
    assert len(recorder.live_constraints) == 2 * len(CLIENT_ONLY_TABLES) + len(
        ANY_TYPE_TABLES
    )


def test_upgrade_ondelete_is_no_action_everywhere(r2):
    """Rule §16: no FK to `companies` may delete the child row.

    The product owner decided (2026-09-30) that nothing is ever hard deleted:
    deactivating a company cascades `is_active = false` and keeps the history.
    `CASCADE`/`SET NULL` on `company_id` would let a hard delete erase tasks,
    teams, contacts, SLAs, routines, proposals and contracts, so every FK is
    NO ACTION — the database refuses the delete and the application deactivates.
    """
    from src.modules.contacts.models import Contact
    from src.modules.contracts.models import Contract
    from src.modules.proposals.models import PricingScenario
    from src.modules.task_manager.models import (
        ClientSLA,
        ClientTemplateAssignment,
        Task,
    )
    from src.modules.team.models import Team

    module, recorder = r2

    module.upgrade()

    created = {
        call[1]: call[4] for call in recorder.calls if call[0] == "create_foreign_key"
    }
    assert created, "the migration created no foreign key"

    def declared_ondelete(table) -> str | None:
        """Reads the `ondelete` of the `company_id` foreign key of a model."""
        for element in table.__table__.constraints:
            if not isinstance(element, ForeignKeyConstraint):
                continue
            if "company_id" in element.columns:
                return element.ondelete
        raise AssertionError(f"{table.__name__} has no FK on company_id")

    assert set(created.values()) == {"NO ACTION"}, created

    models = [
        Task,
        Team,
        ClientSLA,
        ClientTemplateAssignment,
        Contract,
        PricingScenario,
        Contact,
    ]
    for model in models:
        assert declared_ondelete(model) == "NO ACTION", (
            f"{model.__name__}.company_id must not delete the row: "
            f"{declared_ondelete(model)}"
        )


def test_upgrade_declares_the_check_constraints_the_models_declare(r2):
    """Rule: `ck_<table>_company_type` must exist in migration and in model.

    R2 created the check constraint only through the migration; a model missing
    it makes autogenerate emit a `drop_constraint` for a database that has it.
    """
    from src.modules.task_manager.models import Task
    from src.modules.team.models import Team

    module, recorder = r2

    module.upgrade()

    created = {
        call[1] for call in recorder.calls if call[0] == "create_check_constraint"
    }
    assert created == {f"ck_{table}_company_type" for table in CLIENT_ONLY_TABLES}
    for model in (Task, Team):
        names = {
            element.name
            for element in model.__table__.constraints
            if isinstance(element, CheckConstraint)
        }
        assert "ck_teams_company_type" in names or model is Task
