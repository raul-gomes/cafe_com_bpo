"""add contacts

Cria a agenda de contatos do BPO (Gestão › Contatos): nome, telefone, e-mail e
nome da empresa, com escopo por `user_id` e soft delete. O contato dos clientes
NÃO é copiado para cá — é lido de `prospects.representante_*` (fonte única).

Revision ID: 09d0d0d7300b
Revises: d8e9f0a1b2c3
Create Date: 2026-09-28 18:33:43.117701

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "09d0d0d7300b"
down_revision: str | Sequence[str] | None = "d8e9f0a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "contacts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("telefone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("empresa", sa.String(length=255), nullable=True),
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
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contacts_user_active",
        "contacts",
        ["user_id", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_contacts_user_active", table_name="contacts")
    op.drop_table("contacts")
