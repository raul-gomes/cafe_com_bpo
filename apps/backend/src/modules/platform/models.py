import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    UUID,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)

from src.core.database import Base


def _now() -> datetime:
    """Current instant in UTC, with microseconds (keeps close rows ordered).

    Returns:
        The current UTC datetime.
    """
    return datetime.now(UTC)


class Lesson(Base):
    """A video lesson of the Aulas module, published by an administrator.

    `section` is one of the Aulas menu areas (primeiros-passos,
    bpo-primeiros-passos, mentorias). `youtube_id` is derived from `video_url`
    on save, so the page embeds the video without parsing URLs again.
    """

    __tablename__ = "lessons"
    __table_args__ = (Index("ix_lessons_section_position", "section", "position"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section = Column(String(40), nullable=False)
    title = Column(String(150), nullable=False)
    summary = Column(Text, nullable=True)
    video_url = Column(String(500), nullable=True)
    youtube_id = Column(String(20), nullable=True)
    # Order inside the section; lower comes first.
    position = Column(Integer, nullable=False, default=0, server_default="0")
    is_published = Column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at = Column(
        DateTime(timezone=True), default=_now, server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=_now,
        server_default=func.now(),
        onupdate=_now,
        nullable=False,
    )


class Announcement(Base):
    """A message an administrator sends to the users of the platform.

    On creation it is copied into each recipient's notification bell
    (`app_notifications`, type "announcement"). When `show_on_home` is true it
    also appears as a post-it on the home panel until `expires_at`.
    """

    __tablename__ = "announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(120), nullable=False)
    message = Column(String(1000), nullable=False)
    # all | paying | free
    audience = Column(String(20), nullable=False)
    show_on_home = Column(Boolean, nullable=False, default=True, server_default="true")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    recipients_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_by_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(
        DateTime(timezone=True), default=_now, server_default=func.now(), nullable=False
    )


class SiteSetting(Base):
    """An editable piece of the site, stored as JSON under a fixed key.

    Keys are a closed vocabulary validated by the schemas ("login_notice",
    "cafe_meeting"); a missing row means "use the built-in default".
    """

    __tablename__ = "site_settings"

    key = Column(String(80), primary_key=True)
    value = Column(JSON, nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=_now,
        server_default=func.now(),
        onupdate=_now,
        nullable=False,
    )


class CafeRsvp(Base):
    """Someone who confirmed presence in an open café (public page).

    The person chooses which contact to leave: e-mail, phone or both. Not a
    platform user; the team reads the list on the admin page.
    """

    __tablename__ = "cafe_rsvps"
    __table_args__ = (Index("ix_cafe_rsvps_meeting", "meeting_starts_at"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    meeting_starts_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True), default=_now, server_default=func.now(), nullable=False
    )
