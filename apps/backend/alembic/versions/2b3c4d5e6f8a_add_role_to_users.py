"""add role column to users table

Revision ID: 2b3c4d5e6f8a
Revises: a2b3c4d5e6f7
Create Date: 2026-05-19

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2b3c4d5e6f8a"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("role", sa.String(20), server_default="user", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "role")
