"""add webhook_events table

Revision ID: d2e3f4a5b6c7
Revises: a7c3e5b9d1f2
Create Date: 2026-10-06

Written by hand instead of `--autogenerate` on purpose: the database carries
known drift (P-7) and autogenerate would fold those unrelated differences into
this revision. The table below mirrors `WebhookEvent` exactly.

The primary key is the Asaas event id: the webhook dedupes on it, so a replay
loses the insert race here and never reprocesses (P-18). There is no
`updated_at` — the row is an immutable record of an arrival, like a log line.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d2e3f4a5b6c7"
down_revision: str | Sequence[str] | None = "a7c3e5b9d1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "webhook_events",
        sa.Column("event_id", sa.String(length=100), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("event_id"),
    )


def downgrade() -> None:
    op.drop_table("webhook_events")
