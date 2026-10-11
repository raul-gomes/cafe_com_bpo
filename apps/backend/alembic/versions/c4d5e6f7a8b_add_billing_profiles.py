"""add billing_profiles table

Revision ID: c4d5e6f7a8b
Revises: d9e0f1a2b3c4
Create Date: 2026-10-05

Written by hand instead of `--autogenerate` on purpose: the database carries
known drift (P-7) and autogenerate would fold those unrelated differences into
this revision. The table below mirrors `BillingProfile` exactly — regenerate
later once the drift is settled and this revision can be compared against it.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4d5e6f7a8b"
down_revision: str | Sequence[str] | None = "d9e0f1a2b3c4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "billing_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("cpf_cnpj", sa.String(length=14), nullable=False),
        sa.Column("phone", sa.String(length=11), nullable=False),
        sa.Column("address", sa.String(length=200), nullable=False),
        sa.Column("address_number", sa.String(length=20), nullable=False),
        sa.Column("complement", sa.String(length=120), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=False),
        sa.Column("state", sa.String(length=2), nullable=False),
        sa.Column("postal_code", sa.String(length=8), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("billing_profiles")
