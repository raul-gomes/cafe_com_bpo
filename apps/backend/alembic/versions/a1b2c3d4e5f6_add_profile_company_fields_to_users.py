"""add profile company fields to users table

Revision ID: a1b2c3d4e5f6
Revises: 5709a864e1c8
Create Date: 2026-05-27 10:55:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "5709a864e1c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Migration órfã (nunca aplicada): os bancos existentes já nascem com essas
# colunas vindas de migrações ancestrais. O upgrade é idempotente para não
# falhar em ambientes que já possuem a estrutura e ainda aplica em bases novas.
_PROFILE_COLUMNS = [
    ("whatsapp", sa.String(50)),
    ("company_razao_social", sa.String(255)),
    ("company_nome_fantasia", sa.String(255)),
    ("company_cnpj", sa.String(50)),
    ("company_address", sa.Text()),
    ("company_professional_email", sa.String(255)),
    ("company_commercial_phone", sa.String(50)),
    ("company_logo_url", sa.String(500)),
    ("company_color_code", sa.String(10)),
]


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("users")}
    for name, column_type in _PROFILE_COLUMNS:
        if name not in existing:
            op.add_column("users", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = {c["name"] for c in inspector.get_columns("users")}
    for name, _ in reversed(_PROFILE_COLUMNS):
        if name in existing:
            op.drop_column("users", name)
