"""
Notifications Module - Schemas

Pydantic schemas for notification API.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "system"
    related_entity_type: str | None = None
    related_entity_id: UUID | None = None
    triggered_by_user_id: UUID | None = None


class NotificationUpdate(BaseModel):
    is_read: bool | None = None


class MarkEntityReadRequest(BaseModel):
    """Marca como vistas as notificações de um item específico (conversa, tópico…)."""

    related_entity_type: str = Field(
        ..., min_length=1, max_length=50, description="conversation, discussion_post…"
    )
    related_entity_id: UUID


class MarkEntityReadResponse(BaseModel):
    marked: int


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    type: str
    is_read: bool
    related_entity_type: str | None = None
    related_entity_id: UUID | None = None
    triggered_by_user_id: UUID | None = None
    created_at: datetime
    read_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    count: int
