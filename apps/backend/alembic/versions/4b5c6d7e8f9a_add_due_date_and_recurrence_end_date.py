"""add due_date and recurrence_end_date to activity_templates

Revision ID: 4b5c6d7e8f9a
Revises: a1b2c3d4e5f6
Create Date: 2026-05-27 11:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4b5c6d7e8f9a"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "activity_templates",
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "activity_templates",
        sa.Column("recurrence_end_date", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("activity_templates", "recurrence_end_date")
    op.drop_column("activity_templates", "due_date")
