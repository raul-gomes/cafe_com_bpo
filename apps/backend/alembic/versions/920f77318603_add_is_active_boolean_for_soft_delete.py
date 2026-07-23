"""add is_active boolean for soft delete

Revision ID: 920f77318603
Revises: 02455f40aa2c
Create Date: 2026-06-16 14:25:52.340311

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "920f77318603"
down_revision: Union[str, Sequence[str], None] = "02455f40aa2c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_active column and backfill existing deleted records."""
    op.add_column(
        "clients",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "pricing_scenarios",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "tasks",
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
    )

    # Backfill: marcar como inativos registros que já estavam deletados
    op.execute("UPDATE clients SET is_active = false WHERE deleted_at IS NOT NULL")
    op.execute("UPDATE tasks SET is_active = false WHERE deleted_at IS NOT NULL")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("tasks", "is_active")
    op.drop_column("pricing_scenarios", "is_active")
    op.drop_column("clients", "is_active")
