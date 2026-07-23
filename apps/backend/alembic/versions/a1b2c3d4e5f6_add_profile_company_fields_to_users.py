"""add profile company fields to users table

Revision ID: a1b2c3d4e5f6
Revises: 5709a864e1c8
Create Date: 2026-05-27 10:55:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "5709a864e1c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("users", sa.Column("whatsapp", sa.String(50), nullable=True))
    op.add_column(
        "users", sa.Column("company_razao_social", sa.String(255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_nome_fantasia", sa.String(255), nullable=True)
    )
    op.add_column("users", sa.Column("company_cnpj", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("company_address", sa.Text(), nullable=True))
    op.add_column(
        "users", sa.Column("company_professional_email", sa.String(255), nullable=True)
    )
    op.add_column(
        "users", sa.Column("company_commercial_phone", sa.String(50), nullable=True)
    )
    op.add_column("users", sa.Column("company_logo_url", sa.String(500), nullable=True))
    op.add_column(
        "users", sa.Column("company_color_code", sa.String(10), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("users", "company_color_code")
    op.drop_column("users", "company_logo_url")
    op.drop_column("users", "company_commercial_phone")
    op.drop_column("users", "company_professional_email")
    op.drop_column("users", "company_address")
    op.drop_column("users", "company_cnpj")
    op.drop_column("users", "company_nome_fantasia")
    op.drop_column("users", "company_razao_social")
    op.drop_column("users", "whatsapp")
