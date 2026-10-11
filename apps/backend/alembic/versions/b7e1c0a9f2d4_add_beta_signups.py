"""add beta signups

Lista de interessados em ser Beta, captada pela página inicial na fase beta:
nome, e-mail (único, minúsculo), WhatsApp, perfil, faixa de clientes, desafio,
origem e data do aceite da LGPD. Não é usuário do sistema.

Revision ID: b7e1c0a9f2d4
Revises: 09d0d0d7300b
Create Date: 2026-10-11 05:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e1c0a9f2d4"
down_revision: str | Sequence[str] | None = "09d0d0d7300b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "beta_signups",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("whatsapp", sa.String(length=20), nullable=True),
        sa.Column("perfil", sa.String(length=30), nullable=False),
        sa.Column("faixa_clientes", sa.String(length=10), nullable=False),
        sa.Column("desafio", sa.Text(), nullable=True),
        sa.Column("origem", sa.String(length=100), nullable=True),
        sa.Column("consentimento_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_beta_signups_email"), "beta_signups", ["email"], unique=True
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_beta_signups_email"), table_name="beta_signups")
    op.drop_table("beta_signups")
