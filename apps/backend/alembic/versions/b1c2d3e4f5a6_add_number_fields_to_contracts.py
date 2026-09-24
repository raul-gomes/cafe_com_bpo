"""add number, fields and template_sections to contracts

Revision ID: a1b2c3d4e5f6
Revises: f9a0b1c2d3e4
Create Date: 2026-09-24

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | Sequence[str] | None = "f9a0b1c2d3e4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("contracts", sa.Column("number", sa.Integer(), nullable=True))
    op.add_column("contracts", sa.Column("fields", sa.Text(), nullable=True))
    op.add_column(
        "contracts",
        sa.Column(
            "template_sections",
            sa.Text(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("contracts", "template_sections")
    op.drop_column("contracts", "fields")
    op.drop_column("contracts", "number")