from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserPublic(BaseModel):
    id: UUID
    name: str | None = None
    email: str


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
