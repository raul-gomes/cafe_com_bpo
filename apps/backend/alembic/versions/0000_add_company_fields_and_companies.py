"""add company fields to user and create companies table

Revision ID: a1b2c3d4e5f6_add_company_fields
Revises: 7ed13e88c8f0
Create Date: 2026-05-06 15:30:00.000000

"""

from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision = "a1b2c3d4e5f6_add_company_fields"
down_revision = "7ed13e88c8f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add company fields to users table
    op.add_column("users", sa.Column("company_name", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("company_segment", sa.String(100), nullable=True))
    op.add_column("users", sa.Column("company_description", sa.Text(), nullable=True))

    # Create companies table
    op.create_table(
        "companies",
        sa.Column("id", sa.UUID(), nullable=False, default=uuid.uuid4),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("segment", sa.String(100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
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
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create index on user_id
    op.create_index("ix_companies_user_id", "companies", ["user_id"], unique=False)


def downgrade() -> None:
    # Drop companies table
    op.drop_table("companies")

    # Remove company fields from users table
    op.drop_column("users", "company_description")
    op.drop_column("users", "company_segment")
    op.drop_column("users", "company_name")
