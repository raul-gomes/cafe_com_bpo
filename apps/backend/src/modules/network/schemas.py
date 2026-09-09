from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    id: UUID
    name: str | None = None
    email: str

    model_config = ConfigDict(from_attributes=True)


class PostCreate(BaseModel):
    title: str = Field(..., max_length=180)
    message: str
    tags: list[str] = Field(default_factory=list)


class PostResponse(BaseModel):
    id: UUID
    author_id: UUID
    author: UserPublic
    title: str
    message: str
    tags: list[str]
    status: str
    comments_count: int
    views_count: int
    last_activity_at: datetime
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class PaginatedPosts(BaseModel):
    items: list[PostResponse]
    total: int


class CommentCreate(BaseModel):
    message: str


class CommentResponse(BaseModel):
    id: UUID
    post_id: UUID
    author_id: UUID
    author: UserPublic
    message: str
    status: str
    created_at: datetime
    updated_at: datetime
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class SkillResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool = True
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UserSkillCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)


class ProjectInviteCreate(BaseModel):
    invited_user_id: UUID
    message: str = Field(..., min_length=1, max_length=2000)


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=10)
    skills: list[str] = Field(default_factory=list)
    team_size: int = Field(1, ge=1, le=99)
    remote_type: str = Field("remote", pattern="^(remote|onsite|hybrid)$")
    invites: list[ProjectInviteCreate] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=160)
    description: str | None = Field(None, min_length=10)
    skills: list[str] | None = None
    team_size: int | None = Field(None, ge=1, le=99)
    remote_type: str | None = Field(None, pattern="^(remote|onsite|hybrid)$")


class ProjectResponse(BaseModel):
    id: UUID
    owner_id: UUID
    owner: UserPublic
    title: str
    description: str
    status: str
    team_size: int
    remote_type: str
    skills: list[SkillResponse]
    published_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    group_id: UUID | None = None
    is_group_member: bool = False
    is_owner: bool = False
    application_count: int = 0
    applications_closed: bool = False

    model_config = ConfigDict(from_attributes=True)


class PaginatedProjects(BaseModel):
    items: list[ProjectResponse]
    total: int


class ProfessionalMatch(BaseModel):
    id: UUID
    name: str | None = None
    email: str
    biografia: str | None = None
    skills: list[SkillResponse]

    model_config = ConfigDict(from_attributes=True)


class ProjectInvitationResponse(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    invited_user: UserPublic
    message: str
    status: str
    responded_at: datetime | None = None
    created_at: datetime
    conversation_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)


class MessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender: UserPublic
    body: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationListItem(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    participant: UserPublic
    last_message: str | None = None
    last_message_at: datetime | None = None
    created_at: datetime


class ConversationDetail(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    participants: list[UserPublic]
    messages: list[MessageResponse]
    created_at: datetime


class GroupPostCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class GroupPostResponse(BaseModel):
    id: UUID
    group_id: UUID
    author_id: UUID
    author: UserPublic
    body: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectGroupListItem(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    member_count: int
    last_post_at: datetime | None = None
    created_at: datetime


class ProjectGroupDetail(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    is_member: bool = True
    members: list[UserPublic]
    posts: list[GroupPostResponse]
    created_at: datetime


class ProjectApplicationCreate(BaseModel):
    message: str = Field(..., min_length=10, max_length=5000)


class ProjectApplicationResponse(BaseModel):
    id: UUID
    project_id: UUID
    project_title: str
    applicant: UserPublic
    message: str
    status: str
    responded_at: datetime | None = None
    created_at: datetime
    conversation_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)
