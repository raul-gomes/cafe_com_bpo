"""Add routines table and task recurrence fields

Revision ID: add_routines_and_task_fields
Revises: add_roi_simulations
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_routines_and_task_fields'
down_revision = 'add_roi_simulations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'routines',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', UUID(as_uuid=True), sa.ForeignKey('clients.id', ondelete='CASCADE'), nullable=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('process_type', sa.String(50), nullable=True),
        sa.Column('priority', sa.String(50), server_default='medium', nullable=False),
        sa.Column('recurrence', sa.String(50), nullable=False),
        sa.Column('day_of_week', sa.Integer, nullable=True),
        sa.Column('day_of_month', sa.Integer, nullable=True),
        sa.Column('days_before_deadline', sa.Integer, server_default='0', nullable=False),
        sa.Column('deadline_time', sa.String(5), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true', nullable=False),
        sa.Column('last_generated', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.add_column('tasks', sa.Column('process_type', sa.String(50), nullable=True))
    op.add_column('tasks', sa.Column('routine_id', UUID(as_uuid=True), sa.ForeignKey('routines.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'routine_id')
    op.drop_column('tasks', 'process_type')
    op.drop_table('routines')
