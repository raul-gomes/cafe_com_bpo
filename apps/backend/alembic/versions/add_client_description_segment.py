"""add description and segment to clients

Revision ID: add_client_description_segment
Revises: create_tasks_table
Create Date: 2026-05-04

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "add_client_description_segment"
down_revision = "create_tasks_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("clients", sa.Column("segment", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("clients", "segment")
    op.drop_column("clients", "description")
