"""add team tables and moved_by field

Revision ID: a1b2c3d4e5f6
Revises: 88b38077df52
Create Date: 2026-07-03 10:00:00.000000

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "88b38077df52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create client_invitations
    op.create_table(
        "client_invitations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("invited_by", sa.UUID(), nullable=False),
        sa.Column("invited_email", sa.String(255), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_client_invitations_token_hash",
        "client_invitations",
        ["token_hash"],
        unique=True,
    )

    # Create client_invitation_routines
    op.create_table(
        "client_invitation_routines",
        sa.Column("invitation_id", sa.UUID(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(
            ["invitation_id"], ["client_invitations.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["template_id"], ["activity_templates.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("invitation_id", "template_id"),
    )

    # Create client_team_members
    op.create_table(
        "client_team_members",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("invited_by", sa.UUID(), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", "user_id", name="uq_client_team_member"),
    )

    # Add moved_by column to tasks
    op.add_column(
        "tasks",
        sa.Column("moved_by", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_tasks_moved_by",
        "tasks",
        "users",
        ["moved_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_tasks_moved_by", "tasks", type_="foreignkey")
    op.drop_column("tasks", "moved_by")
    op.drop_table("client_team_members")
    op.drop_table("client_invitation_routines")
    op.drop_index("ix_client_invitations_token_hash")
    op.drop_table("client_invitations")
