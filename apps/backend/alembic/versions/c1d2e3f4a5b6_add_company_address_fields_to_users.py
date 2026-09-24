"""add structured company address fields to users

Revision ID: c1d2e3f4a5b6
Revises: 5e6f7a8b9c0d
Create Date: 2026-09-24

Campos de endereço estruturados da empresa no perfil (uf/cidade/rua/bairro/
CEP) para o preenchimento automático via Brasil API e composição do endereço
nos contratos. ``company_address`` (texto livre legado) continua sendo
preenchido/composto quando os campos estruturados estão vazios.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c1d2e3f4a5b6"
down_revision: str | Sequence[str] | None = "5e6f7a8b9c0d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("company_street", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_number", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_complement", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_neighborhood", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_city", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_state", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_cep", sa.String(length=20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "company_cep")
    op.drop_column("users", "company_state")
    op.drop_column("users", "company_city")
    op.drop_column("users", "company_neighborhood")
    op.drop_column("users", "company_complement")
    op.drop_column("users", "company_number")
    op.drop_column("users", "company_street")
