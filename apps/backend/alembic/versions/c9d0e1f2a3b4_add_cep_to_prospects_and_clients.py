"""Add cep to prospects and clients
Revision ID: c9d0e1f2a3b4
Revises: b5c6d7e8f9a0
Create Date: 2026-09-22


"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c9d0e1f2a3b4"
down_revision: str | Sequence[str] | None = "b5c6d7e8f9a0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "prospects",
        sa.Column("cep", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "clients",
        sa.Column("cep", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prospects", "cep")
    op.drop_column("clients", "cep")
