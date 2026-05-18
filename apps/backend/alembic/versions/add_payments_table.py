"""Add payments table

Revision ID: add_payments_table
Revises: add_routines_and_task_fields
Create Date: 2026-05-04

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON


# revision identifiers, used by Alembic.
revision = "add_payments_table"
down_revision = "add_routines_and_task_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
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
        sa.Column("asaas_customer_id", sa.String(100), nullable=True),
        sa.Column("asaas_payment_id", sa.String(100), nullable=True),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), server_default="pending", nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=False),
        sa.Column("due_date", sa.String(10), nullable=False),
        sa.Column("webhook_data", JSON, nullable=True),
        sa.Column("success_url", sa.String(500), nullable=True),
        sa.Column("error_url", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("payments")
