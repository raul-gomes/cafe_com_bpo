"""add source activity to template activities

A private copy (fork) of a general routine records, on each copied activity,
the master activity it came from, so a write that arrives with the master's
id lands on the user's copy (AUD-019). Nullable, no FK: the master activity
may be deleted later. Existing forks keep NULL; the service falls back to an
unambiguous name + order match for them.

Revision ID: d81f3a6c2e57
Revises: a4c8e2f61b93
Create Date: 2026-10-12 16:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d81f3a6c2e57"
down_revision: str | Sequence[str] | None = "a4c8e2f61b93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Adds template_activities.source_activity_id (nullable, indexed)."""
    op.add_column(
        "template_activities",
        sa.Column("source_activity_id", sa.UUID(), nullable=True),
    )
    op.create_index(
        "ix_template_activities_source_activity_id",
        "template_activities",
        ["source_activity_id"],
    )


def downgrade() -> None:
    """Drops template_activities.source_activity_id."""
    op.drop_index(
        "ix_template_activities_source_activity_id", table_name="template_activities"
    )
    op.drop_column("template_activities", "source_activity_id")
