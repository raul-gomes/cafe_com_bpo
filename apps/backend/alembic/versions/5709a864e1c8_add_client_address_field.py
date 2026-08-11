"""add client address field

Revision ID: 5709a864e1c8
Revises: 3b4c5d6e7f8b
Create Date: 2026-05-27 09:54:36.746385

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5709a864e1c8"
down_revision: str | Sequence[str] | None = "3b4c5d6e7f8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("clients", sa.Column("address", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("clients", "address")
