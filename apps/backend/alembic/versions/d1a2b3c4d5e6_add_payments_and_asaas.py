"""add payments table and users.asaas_customer_id

Revision ID: d1a2b3c4d5e6
Revises: c1a2b3c4d5e6
Create Date: 2026-08-17 00:00:00.000000

Recria a tabela `payments` (dropada na migração da980b2122bb durante a
limpeza do schema) e adiciona a coluna `asaas_customer_id` em `users`,
substituindo o antigo armazenamento em `users.metadata` (coluna inexistente).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

from alembic import op

revision: str = "d1a2b3c4d5e6"
down_revision: str | None = "c1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("asaas_customer_id", sa.String(length=100), nullable=True),
    )

    op.create_table(
        "payments",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("asaas_customer_id", sa.String(length=100), nullable=True),
        sa.Column("asaas_payment_id", sa.String(length=100), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("payment_method", sa.String(length=50), nullable=False),
        sa.Column("due_date", sa.String(length=10), nullable=False),
        sa.Column("webhook_data", JSON(), nullable=True),
        sa.Column("success_url", sa.String(length=500), nullable=True),
        sa.Column("error_url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        op.f("ix_payments_user_id"), "payments", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_payments_user_id"), table_name="payments")
    op.drop_table("payments")
    op.drop_column("users", "asaas_customer_id")