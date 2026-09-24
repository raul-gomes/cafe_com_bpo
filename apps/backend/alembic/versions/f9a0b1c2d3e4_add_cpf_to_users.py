"""add cpf column to users

Revision ID: f9a0b1c2d3e4
Revises: f8a9b0c1d2e3
Create Date: 2026-09-22

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f9a0b1c2d3e4"
down_revision: str | Sequence[str] | None = "f8a9b0c1d2e3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("cpf", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "cpf")
