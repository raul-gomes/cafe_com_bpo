"""Add ROI simulations table

Revision ID: add_roi_simulations
Revises: add_gallery_items_table
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = 'add_roi_simulations'
down_revision = 'add_gallery_items_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'roi_simulations',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('current_monthly_cost', sa.Float, nullable=False),
        sa.Column('bpo_monthly_cost', sa.Float, nullable=False),
        sa.Column('employees_count', sa.Integer, nullable=False, server_default='1'),
        sa.Column('hourly_rate', sa.Float, nullable=False),
        sa.Column('error_rate_pct', sa.Float, nullable=False, server_default='0'),
        sa.Column('productivity_gain_pct', sa.Float, nullable=False, server_default='0'),
        sa.Column('timeframe_months', sa.Integer, nullable=False, server_default='12'),
        sa.Column('roi_percentage', sa.Float, nullable=False),
        sa.Column('net_savings', sa.Float, nullable=False),
        sa.Column('payback_months', sa.Float, nullable=False),
        sa.Column('annual_savings', sa.Float, nullable=False),
        sa.Column('llm_explanation', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('roi_simulations')
