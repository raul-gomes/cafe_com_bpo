"""add cancelled_at to tasks

Revision ID: 6b15d07d034d
Revises: 4b5c6d7e8f9a
Create Date: 2026-05-27 12:45:59.772509

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b15d07d034d'
down_revision: Union[str, Sequence[str], None] = '4b5c6d7e8f9a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tasks', sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tasks', 'cancelled_at')
