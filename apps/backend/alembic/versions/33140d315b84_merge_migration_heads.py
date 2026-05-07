"""merge migration heads

Revision ID: 33140d315b84
Revises: a1b2c3d4e5f6_add_company_fields, a1b2c3d4e5f6
Create Date: 2026-05-06 15:26:30.480315

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33140d315b84'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6_add_company_fields', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
