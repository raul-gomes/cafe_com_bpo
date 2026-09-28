"""add profile comments

Comentários de membros sobre o trabalho de outro membro da Comunidade
(página de perfil em /painel/membros/:id). Texto simples, sem HTML.

Revision ID: c7d8e9f0a1b2
Revises: 665aa53ac89e
Create Date: 2026-09-27

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c7d8e9f0a1b2"
down_revision: str | Sequence[str] | None = "665aa53ac89e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profile_comments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
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
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_profile_comments_user_active",
        "profile_comments",
        ["user_id", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_profile_comments_user_active", table_name="profile_comments")
    op.drop_table("profile_comments")
