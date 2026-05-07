"""add password reset tokens table

Revision ID: a1b2c3d4e5f6
Revises: add_payments_table
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa
import uuid


revision = 'a1b2c3d4e5f6'
down_revision = 'add_payments_table'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', sa.Uuid, primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', sa.Uuid, sa.ForeignKey('users.id'), nullable=False),
        sa.Column('token', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean, default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('password_reset_tokens')
