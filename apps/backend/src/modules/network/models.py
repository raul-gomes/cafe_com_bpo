import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    UUID,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from src.core.database import Base


class Skill(Base):
    __tablename__ = "skills"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(120), unique=True, nullable=False)
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = (
        UniqueConstraint("user_id", "skill_id", name="uq_user_skills_user_skill"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    skill = relationship("Skill")


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="open", server_default="open")
    team_size = Column(SmallInteger, nullable=False, default=1, server_default="1")
    remote_type = Column(
        String(20), nullable=False, default="remote", server_default="remote"
    )
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User")
    skills = relationship(
        "ProjectSkill", back_populates="project", cascade="all, delete-orphan"
    )


class ProjectSkill(Base):
    __tablename__ = "project_skills"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "skill_id", name="uq_project_skills_project_skill"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("skills.id"), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    project = relationship("Project", back_populates="skills")
    skill = relationship("Skill")


class DiscussionPost(Base):
    __tablename__ = "discussion_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(180), nullable=False)
    message = Column(Text, nullable=False)
    tags = Column(ARRAY(String), nullable=False, default=list)
    status = Column(String(30), nullable=False, default="published")
    comments_count = Column(Integer, nullable=False, default=0)
    views_count = Column(Integer, nullable=False, default=0)
    last_activity_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    author = relationship("User")
    comments = relationship(
        "DiscussionComment", back_populates="post", cascade="all, delete-orphan"
    )


class DiscussionComment(Base):
    __tablename__ = "discussion_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id = Column(
        UUID(as_uuid=True), ForeignKey("discussion_posts.id"), nullable=False
    )
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="published")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    post = relationship("DiscussionPost", back_populates="comments")
    author = relationship("User")
