from pydantic import BaseModel
from typing import Optional
from uuid import UUID


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
    email: Optional[str] = None
