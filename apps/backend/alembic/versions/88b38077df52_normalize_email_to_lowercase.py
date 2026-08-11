"""normalize email to lowercase

Revision ID: 88b38077df52
Revises: 890275f480f9
Create Date: 2026-07-02 10:23:05.627950

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "88b38077df52"
down_revision: str | Sequence[str] | None = "890275f480f9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Normalize existing emails to lowercase."""
    # Fix existing mixed-case emails
    op.execute("UPDATE users SET email = LOWER(email) WHERE email != LOWER(email)")


def downgrade() -> None:
    """No way to restore original case — data is idempotently lowercase."""
