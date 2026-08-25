"""unify notifications into app_notifications

Revision ID: 276b8d51e2d9
Revises: d1a2b3c4d5e6
Create Date: 2026-08-17 21:41:07.647555

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "276b8d51e2d9"
down_revision: str | Sequence[str] | None = "d1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add triggered_by_user_id to app_notifications (single source of truth)
    op.add_column(
        "app_notifications",
        sa.Column(
            "triggered_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )

    # 2. Migrate existing data from legacy `notifications` (network module)
    #    into app_notifications before dropping the legacy table.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "notifications" in inspector.get_table_names():
        # Insert a row for each legacy notification. Comments of the post are
        # summarized by the post title; comment snippet is loaded if present.
        bind.execute(
            sa.text(
                """
                INSERT INTO app_notifications (
                    id, user_id, title, message, type, is_read,
                    related_entity_type, related_entity_id,
                    triggered_by_user_id, created_at, read_at
                )
                SELECT
                    n.id,
                    n.user_id,
                    'Novo comentário no seu tópico',
                    COALESCE(c.message, p.title),
                    n.type,
                    n.is_read,
                    'discussion_post',
                    n.post_id,
                    n.triggered_by_user_id,
                    n.created_at,
                    n.read_at
                FROM notifications n
                LEFT JOIN discussion_posts p ON p.id = n.post_id
                LEFT JOIN discussion_comments c ON c.id = n.comment_id
                """
            )
        )

        # 3. Drop legacy notifications table
        op.drop_table("notifications")


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "notifications" not in inspector.get_table_names():
        # Recreate legacy table and copy migrated rows back
        op.create_table(
            "notifications",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("type", sa.String(50), nullable=False),
            sa.Column("post_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("comment_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "triggered_by_user_id",
                postgresql.UUID(as_uuid=True),
                nullable=False,
            ),
            sa.Column("is_read", sa.Boolean(), nullable=False),
            sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        bind.execute(
            sa.text(
                """
                INSERT INTO notifications (
                    id, user_id, type, post_id, comment_id,
                    triggered_by_user_id, is_read, read_at, created_at
                )
                SELECT
                    id, user_id, type,
                    related_entity_id,
                    related_entity_id,
                    triggered_by_user_id,
                    is_read, read_at, created_at
                FROM app_notifications
                WHERE related_entity_type = 'discussion_post'
                """
            )
        )

    op.drop_column("app_notifications", "triggered_by_user_id")
