"""add parent_template_id to activity_templates

Revision ID: 47e89dc0e8a7
Revises: 3e5a1b2c9d4f
Create Date: 2026-08-28 02:19:26.207035

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '47e89dc0e8a7'
down_revision: Union[str, Sequence[str], None] = '3e5a1b2c9d4f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'activity_templates',
        sa.Column('parent_template_id', sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        'fk_activity_templates_parent_template_id',
        'activity_templates',
        'activity_templates',
        ['parent_template_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        'fk_activity_templates_parent_template_id',
        'activity_templates',
        type_='foreignkey',
    )
    op.drop_column('activity_templates', 'parent_template_id')
