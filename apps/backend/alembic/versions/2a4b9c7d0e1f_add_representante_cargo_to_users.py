"""add representante cargo to users

Revision ID: 2a4b9c7d0e1f
Revises: 13fe9b86fdca
Create Date: 2026-09-24 18:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a4b9c7d0e1f"
down_revision: str | Sequence[str] | None = "13fe9b86fdca"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "users",
        sa.Column("representante_cargo", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "representante_cargo")
