"""add deleted_at to pricing_scenarios

Revision ID: 02455f40aa2c
Revises: aa6eaf40bd7d
Create Date: 2026-06-16 14:07:15.834119

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "02455f40aa2c"
down_revision: Union[str, Sequence[str], None] = "aa6eaf40bd7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add deleted_at column to pricing_scenarios for soft delete cascade."""
    op.add_column(
        "pricing_scenarios",
        sa.Column(
            "deleted_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove deleted_at column from pricing_scenarios."""
    op.drop_column("pricing_scenarios", "deleted_at")
