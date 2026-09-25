"""add proposal share link and client decision fields

Revision ID: d4e5f6a7b8c9
Revises: 3c5d8f9a1b2c
Create Date: 2026-09-24 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str | Sequence[str] | None = "3c5d8f9a1b2c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "pricing_scenarios",
        sa.Column("public_hash", sa.String(length=128), nullable=True),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column("public_hash_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column("shared_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column(
            "shared_count", sa.Integer(), server_default="0", nullable=False
        ),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column("client_decision", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column("client_observation", sa.Text(), nullable=True),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column("client_decided_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "pricing_scenarios", sa.Column("decision_history", sa.Text(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("pricing_scenarios", "decision_history")
    op.drop_column("pricing_scenarios", "client_decided_at")
    op.drop_column("pricing_scenarios", "client_observation")
    op.drop_column("pricing_scenarios", "client_decision")
    op.drop_column("pricing_scenarios", "shared_count")
    op.drop_column("pricing_scenarios", "shared_at")
    op.drop_column("pricing_scenarios", "public_hash_expires_at")
    op.drop_column("pricing_scenarios", "public_hash")