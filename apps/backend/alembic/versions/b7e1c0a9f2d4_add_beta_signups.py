"""add beta signups

Waiting list of people who want to be Beta testers, collected by the landing
page form during the beta phase: name, e-mail (unique, lowercase), WhatsApp,
profile, client range, challenge, source and the LGPD consent date. Not a
platform user.

Revision ID: b7e1c0a9f2d4
Revises: d2e3f4a5b6c7
Create Date: 2026-10-11 05:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e1c0a9f2d4"
down_revision: str | Sequence[str] | None = "d2e3f4a5b6c7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Creates the beta_signups table."""
    op.create_table(
        "beta_signups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("whatsapp", sa.String(length=20), nullable=True),
        sa.Column("profile", sa.String(length=30), nullable=False),
        sa.Column("client_range", sa.String(length=10), nullable=False),
        sa.Column("challenge", sa.Text(), nullable=True),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_beta_signups_email"), "beta_signups", ["email"], unique=True
    )


def downgrade() -> None:
    """Drops the beta_signups table."""
    op.drop_index(op.f("ix_beta_signups_email"), table_name="beta_signups")
    op.drop_table("beta_signups")
