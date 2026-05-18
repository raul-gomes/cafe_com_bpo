"""add activity_templates, sla and attachments tables

Revision ID: a2b3c4d5e6f7
Revises: 33140d315b84
Create Date: 2026-05-13 10:00:00.000000

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "a2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "33140d315b84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### Create task_phases (missing from previous migrations) ###
    op.create_table(
        "task_phases",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "color", sa.String(length=7), nullable=False, server_default="#6b7280"
        ),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ### Activity Templates ###
    op.create_table(
        "activity_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("process_type", sa.String(length=50), nullable=True),
        sa.Column(
            "recurrence", sa.String(length=50), nullable=False, server_default="monthly"
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ### Template Activities ###
    op.create_table(
        "template_activities",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_day", sa.Integer(), nullable=False),
        sa.Column("estimated_hours", sa.Integer(), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("phase_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["template_id"], ["activity_templates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["phase_id"], ["task_phases.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ### Create app_notifications (missing from previous migrations) ###
    op.create_table(
        "app_notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.String(length=1000), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("related_entity_type", sa.String(length=50), nullable=True),
        sa.Column("related_entity_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ### Add missing columns to tasks (missing from previous migrations) ###
    op.add_column("tasks", sa.Column("phase_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_phase_id",
        "tasks",
        "task_phases",
        ["phase_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "tasks", sa.Column("time_estimate_hours", sa.Integer(), nullable=True)
    )

    # ### Client Template Assignments ###
    op.create_table(
        "client_template_assignments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("template_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
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
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["template_id"], ["activity_templates.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ### Client SLAs ###
    op.create_table(
        "client_slas",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("process_type", sa.String(length=50), nullable=False),
        sa.Column("sla_days", sa.Integer(), nullable=False, server_default="5"),
        sa.Column(
            "warning_threshold", sa.Float(), nullable=False, server_default="0.8"
        ),
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
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ### Task Attachments ###
    op.create_table(
        "task_attachments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(length=100), nullable=True),
        sa.Column("uploaded_by", sa.UUID(), nullable=True),
        sa.Column(
            "sent_to_client", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_column("tasks", "time_estimate_hours")
    op.drop_constraint("fk_tasks_phase_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "phase_id")
    op.drop_table("app_notifications")
    op.drop_table("task_attachments")
    op.drop_table("client_slas")
    op.drop_table("client_template_assignments")
    op.drop_table("template_activities")
    op.drop_table("activity_templates")
    op.drop_table("task_phases")
