"""normalize prospect and client address into separate columns

Revision ID: e7f8a9b0c1d2
Revises: c9d0e1f2a3b4
Create Date: 2026-09-22


"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: str | Sequence[str] | None = "c9d0e1f2a3b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ADDRESS_COLUMNS = [
    sa.Column("street", sa.String(length=255), nullable=True),
    sa.Column("number", sa.String(length=20), nullable=True),
    sa.Column("complement", sa.String(length=255), nullable=True),
    sa.Column("neighborhood", sa.String(length=100), nullable=True),
    sa.Column("city", sa.String(length=100), nullable=True),
    sa.Column("state", sa.String(length=50), nullable=True),
]


def upgrade() -> None:
    op.drop_column("prospects", "address")
    for col in ADDRESS_COLUMNS:
        op.add_column("prospects", col)

    op.drop_column("clients", "address")
    for col in ADDRESS_COLUMNS:
        op.add_column("clients", col)


def downgrade() -> None:
    for col in reversed(ADDRESS_COLUMNS):
        op.drop_column("clients", col.name)
    op.add_column("clients", sa.Column("address", sa.Text(), nullable=True))

    for col in reversed(ADDRESS_COLUMNS):
        op.drop_column("prospects", col.name)
    op.add_column("prospects", sa.Column("address", sa.Text(), nullable=True))
