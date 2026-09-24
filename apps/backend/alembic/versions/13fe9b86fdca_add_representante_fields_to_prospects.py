"""add representante fields to prospects

Revision ID: 13fe9b86fdca
Revises: c1d2e3f4a5b6
Create Date: 2026-09-24 14:17:12.202255

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "13fe9b86fdca"
down_revision: str | Sequence[str] | None = "c1d2e3f4a5b6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PROSPECT_REPRESENTANTE_COLUMNS = (
    sa.Column("representante_nome", sa.String(length=255), nullable=True),
    sa.Column("representante_email", sa.String(length=255), nullable=True),
    sa.Column("representante_cpf", sa.String(length=20), nullable=True),
    sa.Column("representante_telefone", sa.String(length=50), nullable=True),
    sa.Column("representante_cargo", sa.String(length=100), nullable=True),
)


def upgrade() -> None:
    """Upgrade schema."""
    for column in PROSPECT_REPRESENTANTE_COLUMNS:
        op.add_column("prospects", column)


def downgrade() -> None:
    """Downgrade schema."""
    for column in reversed(PROSPECT_REPRESENTANTE_COLUMNS):
        op.drop_column("prospects", column.name)
