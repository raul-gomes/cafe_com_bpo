"""add notes to tasks

Revision ID: 6405e05231c2
Revises: 6b15d07d034d
Create Date: 2026-05-27 13:14:45.123456

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6405e05231c2"
down_revision: Union[str, Sequence[str], None] = "6b15d07d034d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("tasks", sa.Column("notes", sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("tasks", "notes")
