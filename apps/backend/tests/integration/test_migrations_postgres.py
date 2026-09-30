"""Integration: Phase 2.1 migration rehearsal against a real PostgreSQL server.

Why this test exists
--------------------
The whole Phase 2.1 guarantee ("production data stays in the database") is only
proven by running the migrations for real, on PostgreSQL, against a database
that looks like production. It cannot be proven on SQLite: the very first
revision already declares an `ARRAY` column (`discussion_posts.tags`), so
`alembic upgrade` does not even compile there. The default suite therefore only
covers the *shape* of the revisions
(`tests/test_migrations_r2.py` drives `upgrade()`/`downgrade()` against a fake
recorder), while this module runs the genuine chain.

What it does
------------
1. Creates a throwaway database on the server given by
   `TEST_MIGRATION_DATABASE_URL`.
2. Upgrades it to the **production baseline** `09d0d0d7300b` (the revision
   deployed in production before this plan started).
3. Seeds a **clients-only** fixture, which mirrors the production premise
   (populated `clients` and child tables, empty `prospects`, no contracts).
4. Records the baseline: B1 row counts, B2 per-client fingerprints, B3 premise
   check.
5. Runs `alembic upgrade head` and verifies B1, B2 and V1-V5.
6. Runs `alembic upgrade head` a second time and verifies V1-V5 again, proving
   the apply is idempotent.

It also asserts rule §16 on the real engine: PostgreSQL itself refuses to hard
delete a company that still has child rows.

The database is dropped on teardown, and the throwaway name is derived from the
test id (deterministic, never random).
"""

import os
import re
import subprocess
import sys
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url

pytestmark = pytest.mark.integration

# Production is deployed at this revision; everything after it is what this
# plan has to apply without losing data.
BASELINE_REVISION = "09d0d0d7300b"

# Fixed instant: the fixture must not depend on the wall clock.
FIXED_TS = "2026-01-15 12:00:00+00"

BACKEND_ROOT = Path(__file__).resolve().parents[2]

ADMIN_URL_ENV = "TEST_MIGRATION_DATABASE_URL"

# Tables the plan's B1/V1-V5 verification watches.
WATCHED_TABLES = (
    "clients",
    "companies",
    "prospects",
    "tasks",
    "teams",
    "client_slas",
    "client_template_assignments",
    "pricing_scenarios",
    "contracts",
    "contacts",
)


class AlembicFailure(AssertionError):
    """Raised when an `alembic` invocation exits non-zero (with its output)."""


@dataclass
class Rehearsal:
    """A throwaway PostgreSQL database parked on the production baseline.

    Attributes:
        url: Connection string of the scratch database, kept as the exact bytes
            it was built from (see `_with_database`).
        engine: Engine bound to it.
    """

    url: str
    engine: Engine

    def alembic(self, *args: str) -> str:
        """Runs `alembic <args>` in a subprocess against this database.

        The migration runs out-of-process on purpose: `tests/conftest.py`
        replaces `postgresql.ARRAY` with a SQLite text shim at import time, so
        an in-process Alembic run would exercise a dialect that production does
        not use. A subprocess also proves the same command the entrypoint
        (`alembic upgrade head`) works.

        Args:
            *args: Alembic arguments, e.g. `"upgrade", "head"`.

        Returns:
            The combined stdout/stderr of the run.

        Raises:
            AlembicFailure: If Alembic exits non-zero.
        """
        env = {
            **os.environ,
            "DATABASE_URL": self.url,
            "PYTHONDONTWRITEBYTECODE": "1",
        }
        result = subprocess.run(
            [sys.executable, "-m", "alembic", *args],
            cwd=BACKEND_ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            masked = re.sub(r":[^:@/]+@", ":***@", self.url)
            raise AlembicFailure(
                f"alembic {' '.join(args)} failed ({result.returncode}) "
                f"against {masked}:\n{result.stdout}\n{result.stderr}"
            )
        return result.stdout + result.stderr

    def seed_clients_only(self) -> None:
        """Fills the baseline with the shape production has.

        Populated: users, task phases, an activity template, three clients (two
        active and one archived) and the five child tables that carry a
        `client_id` in production. Deliberately empty: `prospects` and
        `contracts` — the production premise of Phase 2.1.
        """
        owner = "11111111-1111-4111-8111-111111111111"
        member = "22222222-2222-4222-8222-222222222222"
        active_client = "33333333-3333-4333-8333-333333333333"
        second_client = "44444444-4444-4444-8444-444444444444"
        archived_client = "55555555-5555-4555-8555-555555555555"
        phase = "66666666-6666-4666-8666-666666666666"
        template = "77777777-7777-4777-8777-777777777777"
        assignment = "88888888-8888-4888-8888-888888888888"

        statements = [
            # Two users, so owner/member relationships are exercised too.
            f"""
            INSERT INTO users (id, email, password_hash, auth_provider, role,
                               name, terms_accepted, created_at, updated_at)
            VALUES ('{owner}', 'owner@example.test', 'x', 'local', 'admin',
                    'Ana Oliveira', true, '{FIXED_TS}', '{FIXED_TS}'),
                   ('{member}', 'member@example.test', 'x', 'local', 'member',
                    'Bruno Sá', true, '{FIXED_TS}', '{FIXED_TS}')
            """,
            f"""
            INSERT INTO task_phases (id, name, color, "order", is_default,
                                     is_done, created_at)
            VALUES ('{phase}', 'Backlog', '#8a8a8a', 1, true, false, '{FIXED_TS}')
            """,
            f"""
            INSERT INTO activity_templates (id, user_id, name, description,
                                            process_type, is_active,
                                            created_at, updated_at)
            VALUES ('{template}', '{owner}', 'Abertura de contas', 'Rotina padrão',
                    'abertura', true, '{FIXED_TS}', '{FIXED_TS}')
            """,
            # Two active clients plus one already archived: `is_active` and
            # `deleted_at` must survive the copy exactly as they are.
            f"""
            INSERT INTO clients (id, user_id, name, cnpj, phone, email, color,
                                 description, segment, cep, street, number,
                                 complement, neighborhood, city, state,
                                 is_active, deleted_at, created_at, updated_at)
            VALUES ('{active_client}', '{owner}', 'Padaria Pão Quente',
                    '11222333000181', '+5511988880001', 'contato@paoquente.test',
                    '#f97316', 'Cliente de teste ativo', 'Comércio - Alimentos',
                    '01001000', 'Rua das Flores', '120', 'Loja 2', 'Centro',
                    'São Paulo', 'SP', true, NULL, '{FIXED_TS}', '{FIXED_TS}'),
                   ('{second_client}', '{member}', 'Clínica Sorriso Leve',
                    '11222333000262', '+5511977770002', 'contato@sorrisoleve.test',
                    '#22c55e', 'Segundo cliente ativo', 'Saúde - Clínicas',
                    '02002000', 'Av. Paulista', '900', NULL, 'Bela Vista',
                    'São Paulo', 'SP', true, NULL, '{FIXED_TS}', '{FIXED_TS}'),
                   ('{archived_client}', '{owner}', 'Distribuidora Antiga Ltda',
                    '11222333000373', '+5511966660003', 'contato@antiga.test',
                    '#64748b', 'Cliente já arquivado', NULL,
                    '03003000', 'Rua Velha', '45', NULL, 'Santana',
                    'São Paulo', 'SP', false, '{FIXED_TS}', '{FIXED_TS}',
                    '{FIXED_TS}')
            """,
            f"""
            INSERT INTO tasks (id, user_id, client_id, title, description,
                               priority, phase_id, is_active, is_cancelled,
                               created_at, updated_at)
            VALUES ('90000000-0000-4000-8000-000000000001', '{owner}',
                    '{active_client}', 'Conferir estoque', 'Tarefa ativa',
                    'media', '{phase}', true, false, '{FIXED_TS}', '{FIXED_TS}'),
                   ('90000000-0000-4000-8000-000000000002', '{owner}',
                    '{active_client}', 'Renovar contrato', 'Outra tarefa',
                    'alta', '{phase}', true, false, '{FIXED_TS}', '{FIXED_TS}'),
                   ('90000000-0000-4000-8000-000000000003', '{member}',
                    '{second_client}', 'Enviar proposta', 'Tarefa do segundo',
                    'baixa', '{phase}', true, false, '{FIXED_TS}', '{FIXED_TS}'),
                   ('90000000-0000-4000-8000-000000000004', '{owner}',
                    '{archived_client}', 'Tarefa antiga', 'Deve sobreviver',
                    'media', '{phase}', true, false, '{FIXED_TS}', '{FIXED_TS}')
            """,
            f"""
            INSERT INTO teams (id, client_id, owner_id, created_at, updated_at)
            VALUES ('a1000000-0000-4000-8000-000000000001', '{active_client}',
                    '{owner}', '{FIXED_TS}', '{FIXED_TS}'),
                   ('a1000000-0000-4000-8000-000000000002', '{second_client}',
                    '{member}', '{FIXED_TS}', '{FIXED_TS}'),
                   ('a1000000-0000-4000-8000-000000000003', '{archived_client}',
                    '{owner}', '{FIXED_TS}', '{FIXED_TS}')
            """,
            f"""
            INSERT INTO client_slas (id, client_id, user_id, process_type,
                                      sla_days, warning_threshold,
                                      created_at, updated_at)
            VALUES ('b1000000-0000-4000-8000-000000000001', '{active_client}',
                    '{owner}', 'abertura', 5, 0.8, '{FIXED_TS}', '{FIXED_TS}')
            """,
            f"""
            INSERT INTO client_template_assignments (id, client_id, template_id,
                                                      user_id, start_date,
                                                      is_active, created_at,
                                                      updated_at)
            VALUES ('{assignment}', '{active_client}', '{template}', '{owner}',
                    '{FIXED_TS}', true, '{FIXED_TS}', '{FIXED_TS}')
            """,
            f"""
            INSERT INTO pricing_scenarios (id, user_id, client_id, client_name,
                                            input_payload, result_payload, number,
                                            is_active, shared_count,
                                            created_at, updated_at)
            VALUES ('c1000000-0000-4000-8000-000000000001', '{owner}',
                    '{active_client}', 'Padaria Pão Quente', '{{}}', '{{}}', 7,
                    true, 0, '{FIXED_TS}', '{FIXED_TS}'),
                   ('c1000000-0000-4000-8000-000000000002', '{member}',
                    '{second_client}', 'Clínica Sorriso Leve', '{{}}', '{{}}', 3,
                    true, 0, '{FIXED_TS}', '{FIXED_TS}')
            """,
        ]
        with self.engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

    def row_counts(self) -> dict[str, int]:
        """Returns B1: the row count of every table the plan watches.

        A count that changes across the apply means the migration touched
        something it should not have, so the rehearsal compares them. Tables the
        migration has not created yet (`companies` at the baseline) are absent
        from the result instead of raising.
        """
        with self.engine.connect() as connection:
            existing = {
                row[0]
                for row in connection.execute(
                    text(
                        "SELECT tablename FROM pg_tables WHERE schemaname = "
                        "'public'"
                    )
                )
            }
            return {
                table: connection.execute(
                    text(f"SELECT count(*) FROM {table}")  # noqa: S608 - fixed list
                ).scalar_one()
                for table in sorted(existing & set(WATCHED_TABLES))
            }

    def fingerprints(self) -> dict[str, str]:
        """Returns B2: an md5 fingerprint per client row.

        The fingerprint covers every column shared with `companies`, including
        `is_active` and `deleted_at`, which is how the rehearsal proves the copy
        did not alter any content.
        """
        query = text(
            """
            SELECT id::text, md5(concat_ws('|', id::text, user_id::text, name,
                coalesce(cnpj, ''), coalesce(phone, ''), coalesce(email, ''),
                coalesce(color, ''), coalesce(description, ''),
                coalesce(segment, ''), coalesce(street, ''),
                coalesce(number, ''), coalesce(complement, ''),
                coalesce(neighborhood, ''), coalesce(city, ''),
                coalesce(state, ''), coalesce(cep, ''), is_active::text,
                coalesce(deleted_at::text, ''), created_at::text,
                updated_at::text))
            FROM clients ORDER BY 1
            """
        )
        with self.engine.connect() as connection:
            return dict(connection.execute(query).all())

    def verify(self) -> dict[str, int]:
        """Runs V1-V5 from the plan and returns the violations found.

        Every value must be 0; the plan's abort criteria key off exactly these
        numbers, so they are collected in one place instead of being retyped by
        hand in a terminal.

        Returns:
            Mapping of verification name to the number of violations.
        """
        checks = {
            "V1_clientes_sem_company": """
                SELECT count(*) FROM clients c
                LEFT JOIN companies co ON co.id = c.id WHERE co.id IS NULL
            """,
            "V1_companies_sem_origem": """
                SELECT count(*) FROM companies co
                LEFT JOIN clients c ON c.id = co.id WHERE c.id IS NULL
            """,
            "V2_divergentes": """
                SELECT count(*) FROM (
                    SELECT id, user_id, name, cnpj, phone, email, color,
                           description, segment, street, number, complement,
                           neighborhood, city, state, cep, is_active,
                           deleted_at, created_at, updated_at FROM clients
                    EXCEPT
                    SELECT id, user_id, name, cnpj, phone, email, color,
                           description, segment, street, number, complement,
                           neighborhood, city, state, cep, is_active,
                           deleted_at, created_at, updated_at FROM companies
                ) divergente
            """,
            "V2_divergentes_inverso": """
                SELECT count(*) FROM (
                    SELECT id, user_id, name, cnpj, phone, email, color,
                           description, segment, street, number, complement,
                           neighborhood, city, state, cep, is_active,
                           deleted_at, created_at, updated_at FROM companies
                    EXCEPT
                    SELECT id, user_id, name, cnpj, phone, email, color,
                           description, segment, street, number, complement,
                           neighborhood, city, state, cep, is_active,
                           deleted_at, created_at, updated_at FROM clients
                ) divergente
            """,
            "V3_orfaos": """
                SELECT (SELECT count(*) FROM tasks t
                        LEFT JOIN companies co ON co.id = t.client_id
                        WHERE t.client_id IS NOT NULL AND co.id IS NULL)
                     + (SELECT count(*) FROM teams t
                        LEFT JOIN companies co ON co.id = t.client_id
                        WHERE t.client_id IS NOT NULL AND co.id IS NULL)
                     + (SELECT count(*) FROM client_slas s
                        LEFT JOIN companies co ON co.id = s.client_id
                        WHERE s.client_id IS NOT NULL AND co.id IS NULL)
                     + (SELECT count(*) FROM client_template_assignments a
                        LEFT JOIN companies co ON co.id = a.client_id
                        WHERE a.client_id IS NOT NULL AND co.id IS NULL)
                     + (SELECT count(*) FROM pricing_scenarios p
                        LEFT JOIN companies co ON co.id = p.client_id
                        WHERE p.client_id IS NOT NULL AND co.id IS NULL)
                     + (SELECT count(*) FROM pricing_scenarios p
                        LEFT JOIN companies co ON co.id = p.prospect_id
                        WHERE p.prospect_id IS NOT NULL AND co.id IS NULL)
                     + (SELECT count(*) FROM contracts ct
                        LEFT JOIN companies co ON co.id = ct.prospect_id
                        WHERE ct.prospect_id IS NOT NULL AND co.id IS NULL)
            """,
            "V4_client_only_apontando_para_prospect": """
                SELECT (SELECT count(*) FROM tasks t JOIN companies co ON co.id = t.client_id
                        WHERE co.type <> 'client')
                     + (SELECT count(*) FROM teams t JOIN companies co ON co.id = t.client_id
                        WHERE co.type <> 'client')
                     + (SELECT count(*) FROM client_slas s JOIN companies co ON co.id = s.client_id
                        WHERE co.type <> 'client')
                     + (SELECT count(*) FROM client_template_assignments a
                        JOIN companies co ON co.id = a.client_id
                        WHERE co.type <> 'client')
            """,
            "V5_backfill_divergente": """
                SELECT (SELECT count(*) FROM tasks
                        WHERE client_id IS DISTINCT FROM company_id)
                     + (SELECT count(*) FROM teams
                        WHERE client_id IS DISTINCT FROM company_id)
                     + (SELECT count(*) FROM client_slas
                        WHERE client_id IS DISTINCT FROM company_id)
                     + (SELECT count(*) FROM client_template_assignments
                        WHERE client_id IS DISTINCT FROM company_id)
                     + (SELECT count(*) FROM pricing_scenarios
                        WHERE company_id IS DISTINCT FROM coalesce(client_id, prospect_id))
            """,
        }
        with self.engine.connect() as connection:
            return {
                name: connection.execute(text(query)).scalar_one()
                for name, query in checks.items()
            }


def _scratch_database_name(node_id: str) -> str:
    """Builds the deterministic throwaway database name for a test.

    Args:
        node_id: The pytest node id of the test requesting the database.

    Returns:
        A name safe for PostgreSQL, unique per test and stable across runs.
    """
    slug = re.sub(r"[^a-z0-9]+", "_", node_id.lower()).strip("_")
    return f"rehearsal_{slug}"[:60]


def _with_database(raw_url: str, name: str) -> str:
    """Points a connection string at another database, keeping it byte-identical.

    `sqlalchemy.engine.make_url(...).set(database=...)` is not usable here: its
    `str()` re-encodes the password, and a password that legitimately contains
    URL-significant characters then reaches the server as a different one (the
    server answers "password authentication failed" even though the original
    string authenticates fine). Rewriting only the path segment leaves the
    credentials exactly as the operator wrote them.

    Args:
        raw_url: Connection string whose database part is to be replaced.
        name: Name of the database to point at.

    Returns:
        The same connection string, pointing at `name`.
    """
    base, separator, query = raw_url.partition("?")
    head, _, _ = base.rpartition("/")
    if not head:
        raise ValueError(f"connection string has no database part: {raw_url!r}")
    return f"{head}/{name}{separator}{query}"


def _drop_database(admin_url: str, name: str) -> None:
    """Drops the throwaway database, ending any lingering connection first.

    Args:
        admin_url: URL of the maintenance database, used to issue the DROP.
        name: Name of the database to drop.
    """
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as connection:
            connection.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :name AND pid <> pg_backend_pid()"
                ),
                {"name": name},
            )
            connection.execute(text(f'DROP DATABASE IF EXISTS "{name}"'))
    finally:
        engine.dispose()


def _create_database(admin_url: str, name: str) -> str:
    """Creates an empty throwaway database and returns its URL.

    Args:
        admin_url: URL of the maintenance database that owns the server.
        name: Name of the database to create.

    Returns:
        A SQLAlchemy URL pointing at the new database.
    """
    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with engine.connect() as connection:
            connection.execute(text(f'CREATE DATABASE "{name}"'))
    finally:
        engine.dispose()
    return _with_database(admin_url, name)


@pytest.fixture(scope="session")
def postgres_admin_url() -> str:
    """Resolves the server this rehearsal runs against, or skips.

    Skipping (instead of failing) is what keeps `pytest -m integration` usable
    on a developer machine that has no PostgreSQL: the Cloudinary and Resend
    suites use the same convention.

    Returns:
        The connection string of the maintenance database, unchanged.
    """
    raw = os.environ.get(ADMIN_URL_ENV)
    if not raw:
        pytest.skip(
            f"{ADMIN_URL_ENV} is not set: this rehearsal needs a real "
            "PostgreSQL (the migration chain uses ARRAY columns)."
        )
    if make_url(raw).get_backend_name() != "postgresql":
        pytest.skip(f"{ADMIN_URL_ENV} must be a PostgreSQL URL.")
    return _with_database(raw, "postgres")


@pytest.fixture
def rehearsal(request: pytest.FixtureRequest, postgres_admin_url: str) -> Iterator[Rehearsal]:
    """Yields a throwaway database parked on the production baseline.

    Per-test (not session-scoped) so the database name is derived from the test
    id and each test gets a clean slate; the schema is expensive to build, but
    this is an opt-in suite.

    Args:
        request: The pytest request, used to name the database.
        postgres_admin_url: Connection string of the maintenance database.

    Yields:
        A `Rehearsal` bound to the seeded baseline database.
    """
    name = _scratch_database_name(request.node.nodeid)
    _drop_database(postgres_admin_url, name)
    url = _create_database(postgres_admin_url, name)
    engine = create_engine(url)
    rehearsal_obj = Rehearsal(url=url, engine=engine)
    try:
        rehearsal_obj.alembic("upgrade", BASELINE_REVISION)
        rehearsal_obj.seed_clients_only()
        yield rehearsal_obj
    finally:
        engine.dispose()
        _drop_database(postgres_admin_url, name)


def test_the_production_premise_holds_on_the_fixture(rehearsal: Rehearsal) -> None:
    """B3: the fixture really is the shape Phase 2.1 was planned against.

    If `prospects` were not empty the collapse of converted pairs would have
    rows to chew on in production, which is precisely the case the plan says to
    stop and re-review for.
    """
    counts = rehearsal.row_counts()
    assert counts["prospects"] == 0, "fixture must have no prospects (B3)"
    assert counts["contracts"] == 0, "production has no contracts"
    assert counts["clients"] == 3
    assert counts["tasks"] == 4
    assert counts["teams"] == 3


def test_upgrading_to_head_keeps_every_row_and_every_column(
    rehearsal: Rehearsal,
) -> None:
    """B1 + B2 + V1-V5 green: the apply on a clients-only production copy.

    This is the rehearsal the plan's checklist demands before touching the real
    database. Any non-zero number is an abort.
    """
    baseline_counts = rehearsal.row_counts()
    baseline_fingerprints = rehearsal.fingerprints()
    assert baseline_fingerprints, "the fixture must have clients to compare"

    rehearsal.alembic("upgrade", "head")

    after = rehearsal.row_counts()
    for table, count in baseline_counts.items():
        assert after.get(table) == count, (
            f"B1: row count of {table} changed ({count} -> {after.get(table)})"
        )
    assert after["companies"] == baseline_counts["clients"], (
        "companies must hold exactly one row per client"
    )

    assert rehearsal.fingerprints() == baseline_fingerprints, (
        "B2: a client fingerprint changed — the copy altered content"
    )

    violations = rehearsal.verify()
    assert violations == dict.fromkeys(violations, 0), f"V1-V5 violations: {violations}"


def test_running_the_apply_twice_changes_nothing(rehearsal: Rehearsal) -> None:
    """V1-V5 stay green after a second `upgrade head` (idempotence).

    The checklist requires the verification to be repeated twice, because a
    partially applied chain that a rerun papers over is exactly what turns into
    a broken production apply.
    """
    rehearsal.alembic("upgrade", "head")
    first = rehearsal.verify()
    counts_after_first = rehearsal.row_counts()
    fingerprints_after_first = rehearsal.fingerprints()

    rehearsal.alembic("upgrade", "head")

    second = rehearsal.verify()
    assert second == dict.fromkeys(second, 0), f"V1-V5 violations: {second}"
    assert second == first, "the second run verified differently from the first"
    assert rehearsal.row_counts() == counts_after_first
    assert rehearsal.fingerprints() == fingerprints_after_first


def test_the_engine_refuses_to_hard_delete_a_company(rehearsal: Rehearsal) -> None:
    """Rule §16 on the real engine: a company with children cannot be deleted.

    The application deactivates; the database refuses. If a future migration
    loosens one of these foreign keys, this fails.
    """
    from sqlalchemy.exc import IntegrityError

    rehearsal.alembic("upgrade", "head")

    client_with_children = rehearsal.fingerprints()
    assert client_with_children, "fixture must have clients"
    victim = next(iter(client_with_children))

    with pytest.raises(IntegrityError):
        with rehearsal.engine.begin() as connection:
            connection.execute(
                text("DELETE FROM companies WHERE id = CAST(:id AS uuid)"),
                {"id": victim},
            )


def test_the_archived_client_survives_the_whole_apply(rehearsal: Rehearsal) -> None:
    """The already-archived client keeps its `deleted_at` and its child rows.

    Rule §16 asks for the history of when a company was active; a client
    archived before the apply must come out of it untouched.
    """
    rehearsal.alembic("upgrade", "head")

    with rehearsal.engine.connect() as connection:
        archived = connection.execute(
            text(
                """
                SELECT co.name, co.is_active, co.deleted_at, co.type
                FROM companies co WHERE co.is_active = false
                """
            )
        ).all()
        assert len(archived) == 1, "the fixture has exactly one archived client"
        name, is_active, deleted_at, company_type = archived[0]
        assert name == "Distribuidora Antiga Ltda"
        assert is_active is False
        assert deleted_at is not None, "an archived client must keep its date"
        assert company_type == "client"

        surviving_tasks = connection.execute(
            text(
                "SELECT count(*) FROM tasks t JOIN companies co "
                "ON co.id = t.company_id WHERE co.name = :name"
            ),
            {"name": "Distribuidora Antiga Ltda"},
        ).scalar_one()
        assert surviving_tasks == 1, "the archived client's task must survive"
