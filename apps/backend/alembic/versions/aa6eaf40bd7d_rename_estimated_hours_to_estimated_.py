"""rename estimated_hours to estimated_minutes

Revision ID: aa6eaf40bd7d
Revises: 359ccfa717d1
Create Date: 2026-06-08 11:50:04.174489

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "aa6eaf40bd7d"
down_revision: Union[str, Sequence[str], None] = "359ccfa717d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        "tasks", "time_estimate_hours", new_column_name="time_estimate_minutes"
    )
    op.alter_column(
        "template_activities", "estimated_hours", new_column_name="estimated_minutes"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        "tasks", "time_estimate_minutes", new_column_name="time_estimate_hours"
    )
    op.alter_column(
        "template_activities", "estimated_minutes", new_column_name="estimated_hours"
    )
