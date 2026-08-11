from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UrgentTaskResponse(BaseModel):
    id: UUID
    title: str
    client_name: str
    deadline: datetime | None = None
    priority: str
    status: str
    days_remaining: int | None = None
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class ActivityResponse(BaseModel):
    id: UUID
    type: str
    created_at: datetime
    is_read: bool
    post_id: UUID | None = None
    comment_id: UUID | None = None
    triggered_by_name: str
    message_snippet: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    user_name: str
    urgent_tasks: list[UrgentTaskResponse]
    activities: list[ActivityResponse]
    stats: dict = {}
