"""add platform content and courtesy grants

Tables managed from the admin panel: lessons (Aulas module videos),
announcements (broadcast to the notification bell and the home post-it),
site_settings (login notice, open café), cafe_rsvps (public attendance
confirmations) and courtesy_grants (free full access for a period).

Revision ID: a4c8e2f61b93
Revises: b7e1c0a9f2d4
Create Date: 2026-10-12 04:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a4c8e2f61b93"
down_revision: str | Sequence[str] | None = "b7e1c0a9f2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamp(name: str, *, nullable: bool = False) -> sa.Column:
    """A timezone-aware timestamp column defaulting to now.

    Args:
        name: Column name.
        nullable: Whether the column accepts NULL.

    Returns:
        The column.
    """
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=nullable,
    )


def upgrade() -> None:
    """Creates the platform content tables and courtesy_grants."""
    op.create_table(
        "lessons",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("section", sa.String(40), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("video_url", sa.String(500), nullable=True),
        sa.Column("youtube_id", sa.String(20), nullable=True),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default="false", nullable=False),
        _timestamp("created_at"),
        _timestamp("updated_at"),
    )
    op.create_index("ix_lessons_section_position", "lessons", ["section", "position"])

    op.create_table(
        "announcements",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("message", sa.String(1000), nullable=False),
        sa.Column("audience", sa.String(20), nullable=False),
        sa.Column("show_on_home", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recipients_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "created_by_user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        _timestamp("created_at"),
    )

    op.create_table(
        "site_settings",
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("updated_by", sa.String(255), nullable=True),
        _timestamp("updated_at"),
    )

    op.create_table(
        "cafe_rsvps",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("meeting_starts_at", sa.DateTime(timezone=True), nullable=False),
        _timestamp("created_at"),
    )
    op.create_index("ix_cafe_rsvps_meeting", "cafe_rsvps", ["meeting_starts_at"])

    op.create_table(
        "courtesy_grants",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "user_id",
            sa.UUID(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        _timestamp("granted_at"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("granted_by", sa.String(255), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_courtesy_grants_user_expires", "courtesy_grants", ["user_id", "expires_at"]
    )


def downgrade() -> None:
    """Drops the tables created by this revision."""
    op.drop_index("ix_courtesy_grants_user_expires", table_name="courtesy_grants")
    op.drop_table("courtesy_grants")
    op.drop_index("ix_cafe_rsvps_meeting", table_name="cafe_rsvps")
    op.drop_table("cafe_rsvps")
    op.drop_table("site_settings")
    op.drop_table("announcements")
    op.drop_index("ix_lessons_section_position", table_name="lessons")
    op.drop_table("lessons")
