"""Add color column to clients

Revision ID: add_color_col
Revises: 0001e729b3a8
Create Date: 2026-04-22 10:02:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "add_color_col"
down_revision: str | Sequence[str] | None = "0001e729b3a8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("color", sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "color")
