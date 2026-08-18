"""
Notifications Module - Schemas

Pydantic schemas for notification API.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class NotificationCreate(BaseModel):
    title: str
    message: str
    type: str = "system"
    related_entity_type: str | None = None
    related_entity_id: UUID | None = None
    triggered_by_user_id: UUID | None = None


class NotificationUpdate(BaseModel):
    is_read: bool | None = None


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
