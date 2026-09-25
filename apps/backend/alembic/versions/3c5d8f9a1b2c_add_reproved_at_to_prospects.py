"""add reproved_at to prospects

Revision ID: 3c5d8f9a1b2c
Revises: 2a4b9c7d0e1f
Create Date: 2026-09-24 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3c5d8f9a1b2c"
down_revision: str | Sequence[str] | None = "2a4b9c7d0e1f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "prospects",
        sa.Column("reproved_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("prospects", "reproved_at")