"""R2 — fills `company_id` on the child tables from the legacy columns.

The delicate part: **a proposal or a contract can point at a prospect that has
already become a client**. Because the pair collapsed into a single row (the
client's `id`), following the conversion is what stops the row from pointing at
a company that no longer exists. A business that starts as a prospect is the
same company once it is won — the link must not vanish in between.

In the client-only tables (`tasks`, `teams`, `client_slas`,
`client_template_assignments`) there is no ambiguity: `client_id` already is the
company.

Migration safety
----------------
This module runs **inside revision R2**, so it must never select a column that a
later revision adds. The models, however, always describe head: as soon as R3
gave `teams`/`client_slas`/`client_template_assignments` their `is_active` and
`deleted_at`, a plain `select(Team)` started asking PostgreSQL for columns that
do not exist yet at this point of the chain, and the migration died with
`column teams.is_active does not exist`. `BACKFILL_COLUMNS` is the guard: it
projects only the columns that are guaranteed to be there when R2 runs, so a
future revision adding a column cannot retroactively break this one.
"""

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from src.modules.clients.models import Client
from src.modules.companies.models import Company
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.task_manager.models import (
    ClientSLA,
    ClientTemplateAssignment,
    Task,
)
from src.modules.team.models import Team

# (model, accepts a prospect?) — decides whether the row must follow the conversion
LEGACY_OWNED = (
    (PricingScenario, True),
    (Contract, True),
    (Task, False),
    (Team, False),
    (ClientSLA, False),
    (ClientTemplateAssignment, False),
)

# The only columns the backfill reads or writes. Everything else a model may
# declare is deliberately left out: see the module docstring.
BACKFILL_COLUMNS = ("id", "company_id", "company_type", "client_id", "prospect_id")


@dataclass
class FkBackfillReport:
    """What the backfill did, for the migration log and for assertions.

    Attributes:
        updated: Rows whose `company_id` was filled in.
        already_set: Rows that already had an owner.
        without_owner: Rows with no client and no prospect (a free-floating
            proposal or contract), which legitimately stay without an owner.
        failures: Human-readable reasons a candidate owner was rejected.
    """

    updated: int = 0
    already_set: int = 0
    without_owner: int = 0
    failures: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        """Returns the report as a dict, for the migration log.

        Returns:
            The counters keyed by English names.
        """
        return {
            "updated": self.updated,
            "already_set": self.already_set,
            "without_owner": self.without_owner,
            "failures": self.failures,
        }


def _loadable_columns(model: type) -> tuple:
    """Picks the backfill columns a model actually declares.

    Args:
        model: The ORM model of a child table.

    Returns:
        The mapped attributes named in `BACKFILL_COLUMNS` that exist on the
        model, in that order.
    """
    return tuple(
        attribute
        for attribute in (getattr(model, name, None) for name in BACKFILL_COLUMNS)
        if attribute is not None
    )


def _company_for(
    row, follow_conversion: bool, conversions: dict[UUID, UUID]
) -> UUID | None:
    """Returns the company that owns a row, or `None` when it has no owner.

    `client_id` winning over `prospect_id` should never be ambiguous, but if it
    happens the client wins: it is the most advanced stage of the lifecycle.
    `contracts` only has `prospect_id`, which is why this reads `getattr`.

    Args:
        row: A row of a legacy-owned table.
        follow_conversion: Whether a prospect must be resolved through
            `conversions` (the collapsed pair) instead of used as is.
        conversions: Maps a collapsed prospect id to the client id that replaced it.

    Returns:
        The owning company id, or `None` when the row has no owner.
    """
    client_id = getattr(row, "client_id", None)
    if client_id is not None:
        return client_id
    prospect_id = getattr(row, "prospect_id", None)
    if prospect_id is None:
        return None
    if follow_conversion:
        return conversions.get(prospect_id, prospect_id)
    return prospect_id


def _conversions(session: Session, company_ids: set[UUID]) -> dict[UUID, UUID]:
    """Maps collapsed prospects to the client that replaced them.

    Only pairs that really collapsed are mapped: the prospect has to exist as a
    company too. A dangling `converted_client_id` would otherwise send the row
    to an id that belongs to no company.

    Args:
        session: Session bound to the migrating database.
        company_ids: Ids that exist as companies.

    Returns:
        Maps prospect id to the client id that absorbed it.
    """
    client_ids = set(session.scalars(select(Client.id)))
    return {
        prospect_id: converted
        for prospect_id, converted in session.execute(
            select(Prospect.id, Prospect.converted_client_id).where(
                Prospect.converted_client_id.is_not(None)
            )
        )
        if converted in client_ids
    }


def resolve_company_id(session: Session, row, follow_conversion: bool) -> UUID | None:
    """Returns the company that owns a row, or `None` if that owner is invalid.

    Used by both the backfill and the double-write listeners, so that the two
    halves agree on what an owning company is. It does not trust an already
    filled `company_id`: the caller decides.

    Args:
        session: Session bound to the database.
        row: The row whose owner must be resolved.
        follow_conversion: Whether a prospect follows the collapsed pair.

    Returns:
        The owning company id, or `None` when there is no valid owner.
    """
    company_ids = set(session.scalars(select(Company.id)))
    conversions = _conversions(session, company_ids)
    owner = _company_for(row, follow_conversion, conversions)
    if owner is None or owner not in company_ids:
        return None
    return owner


def backfill_company_fks(session: Session) -> FkBackfillReport:
    """Fills `company_id` on every legacy-owned row and returns what it did.

    The company has to exist: without that check an orphan `client_id` (or a
    prospect that became a client before R1 ran) would produce a `company_id`
    pointing at nothing — and the foreign key would pass, because a foreign key
    is only validated by PostgreSQL and this code runs inside the migration.

    Args:
        session: Session bound to the migrating database. The caller commits.

    Returns:
        The `FkBackfillReport` describing the run.
    """
    report = FkBackfillReport()

    company_ids = set(session.scalars(select(Company.id)))
    conversions = _conversions(session, company_ids)

    for model, follow_conversion in LEGACY_OWNED:
        statement = select(model).options(load_only(*_loadable_columns(model)))
        for row in session.scalars(statement):
            if row.company_id is not None:
                report.already_set += 1
                continue
            company_id = _company_for(row, follow_conversion, conversions)
            if company_id is None:
                # A free-floating proposal/contract (no client, no prospect) is
                # legitimate: it has no owner and stays that way.
                report.without_owner += 1
                continue
            if company_id not in company_ids:
                report.failures.append(
                    f"{model.__tablename__}:{row.id} -> {company_id} is not a company"
                )
                continue
            row.company_id = company_id
            if hasattr(model, "company_type"):
                row.company_type = "client"
            report.updated += 1

    session.flush()
    return report
