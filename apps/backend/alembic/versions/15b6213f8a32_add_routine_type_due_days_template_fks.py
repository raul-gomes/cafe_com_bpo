"""add routine_type due_days template_fks

Revision ID: 15b6213f8a32
Revises: e0e12c9be2cd
Create Date: 2026-06-01 16:56:47.842617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15b6213f8a32'
down_revision: Union[str, Sequence[str], None] = 'e0e12c9be2cd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create routine_types table
    op.create_table('routine_types',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('color', sa.String(length=10), nullable=True),
        sa.Column('suggestions', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Add routine_type_id FK to activity_templates
    op.add_column('activity_templates', sa.Column('routine_type_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_activity_templates_routine_type',
        'activity_templates', 'routine_types',
        ['routine_type_id'], ['id'],
        ondelete='SET NULL'
    )

    # Add due_days to template_activities
    op.add_column('template_activities', sa.Column('due_days', sa.Integer(), nullable=True))

    # Add template_id + assignment_id FK to tasks
    op.add_column('tasks', sa.Column('template_id', sa.UUID(), nullable=True))
    op.add_column('tasks', sa.Column('assignment_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_tasks_template',
        'tasks', 'activity_templates',
        ['template_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_foreign_key(
        'fk_tasks_assignment',
        'tasks', 'client_template_assignments',
        ['assignment_id'], ['id'],
        ondelete='SET NULL'
    )

    # Remove orphaned routine_id column from tasks (legacy)
    op.drop_column('tasks', 'routine_id')


def downgrade() -> None:
    """Downgrade schema."""
    # Restore orphaned routine_id
    op.add_column('tasks', sa.Column('routine_id', sa.UUID(), nullable=True))

    # Remove new FKs and columns
    op.drop_constraint('fk_tasks_assignment', 'tasks', type_='foreignkey')
    op.drop_constraint('fk_tasks_template', 'tasks', type_='foreignkey')
    op.drop_column('tasks', 'assignment_id')
    op.drop_column('tasks', 'template_id')

    op.drop_column('template_activities', 'due_days')

    op.drop_constraint('fk_activity_templates_routine_type', 'activity_templates', type_='foreignkey')
    op.drop_column('activity_templates', 'routine_type_id')

    op.drop_table('routine_types')
