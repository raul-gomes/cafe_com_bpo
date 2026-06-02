"""add company_color_secondary

Revision ID: e0e12c9be2cd
Revises: 355dc46a3695
Create Date: 2026-06-01 16:27:10.016851

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e0e12c9be2cd'
down_revision: Union[str, Sequence[str], None] = '355dc46a3695'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('company_color_secondary', sa.String(length=10), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'company_color_secondary')
