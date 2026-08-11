"""merge migration heads

Revision ID: 33140d315b84
Revises: a1b2c3d4e5f6_add_company_fields, a1b2c3d4e5f6
Create Date: 2026-05-06 15:26:30.480315

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "33140d315b84"
down_revision: str | Sequence[str] | None = (
    "a1b2c3d4e5f6_add_company_fields",
    "a1b2c3d4e5f6_password_reset",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
