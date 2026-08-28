"""enlarge gallery file_type columns

Revision ID: 3e5a1b2c9d4f
Revises: 2c3f53fcef02
Create Date: 2026-08-27 19:20:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3e5a1b2c9d4f"
down_revision: str | Sequence[str] | None = "2c3f53fcef02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Amplia file_type para acomodar MIME types longos (ex.: .docx)."""
    op.alter_column(
        "gallery_items",
        "file_type",
        existing_type=sa.VARCHAR(length=50),
        type_=sa.String(length=255),
        existing_nullable=False,
    )
    op.alter_column(
        "common_gallery_items",
        "file_type",
        existing_type=sa.VARCHAR(length=50),
        type_=sa.String(length=255),
        existing_nullable=False,
    )


def downgrade() -> None:
    """Retorna file_type ao tamanho original."""
    op.alter_column(
        "common_gallery_items",
        "file_type",
        existing_type=sa.String(length=255),
        type_=sa.VARCHAR(length=50),
        existing_nullable=False,
    )
    op.alter_column(
        "gallery_items",
        "file_type",
        existing_type=sa.String(length=255),
        type_=sa.VARCHAR(length=50),
        existing_nullable=False,
    )
