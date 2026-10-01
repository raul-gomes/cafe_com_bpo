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
    """What the notification screens render.

    The fields a page actually reads: `id` (mark as read, delete), `type`
    (icon, category and route), `is_read` (row highlight), `title`, `message`
    and `created_at` (the time shown), plus the pair
    `related_entity_type`/`related_entity_id` that groups unread badges per
    conversation or post (`lib/notificationIndicators.ts`).

    Out, because nothing renders them: `user_id` (the list is already scoped to
    the caller), `triggered_by_user_id` and `read_at`.
    """

    id: UUID
    title: str
    message: str
    type: str
    is_read: bool
    related_entity_type: str | None = None
    related_entity_id: UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountResponse(BaseModel):
    count: int
