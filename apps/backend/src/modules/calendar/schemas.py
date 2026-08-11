from uuid import UUID

from pydantic import BaseModel


class CalendarSyncRequest(BaseModel):
    task_ids: list[UUID]


class CalendarSyncResponse(BaseModel):
    synced: int
    failed: int
    details: list[dict]


class CalendarAuthUrlResponse(BaseModel):
    auth_url: str


class TokenStatusResponse(BaseModel):
    connected: bool
    email: str | None = None
