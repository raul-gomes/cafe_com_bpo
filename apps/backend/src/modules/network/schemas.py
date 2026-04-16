from pydantic import BaseModel, ConfigDict, Field, validator
from typing import List, Optional
from datetime import datetime
from uuid import UUID

class UserPublic(BaseModel):
    id: UUID
    name: Optional[str] = None
    email: str

class PostCreate(BaseModel):
    title: str = Field(..., max_length=180)
    message: str
    tags: List[str] = Field(default_factory=list)

class PostResponse(BaseModel):
    id: UUID
    author_id: UUID
    author: UserPublic
    title: str
    message: str
    tags: List[str]
    status: str
    comments_count: int
    views_count: int
    last_activity_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PaginatedPosts(BaseModel):
    items: List[PostResponse]
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

    model_config = ConfigDict(from_attributes=True)

class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    post_id: UUID
    comment_id: UUID
    triggered_by_user_id: UUID
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class PaginatedNotifications(BaseModel):
    items: List[NotificationResponse]
    total: int
