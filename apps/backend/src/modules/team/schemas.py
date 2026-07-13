from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class InviteCreate(BaseModel):
    emails: list[str]
    template_ids: list[UUID]


class InviteResult(BaseModel):
    email: str
    status: str
    invitation_id: Optional[UUID] = None
    error: Optional[str] = None


class InviteBatchResponse(BaseModel):
    results: list[InviteResult]
    total_sent: int
    total_errors: int


class RoutineAccess(BaseModel):
    template_id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class TeamMemberResponse(BaseModel):
    user_id: UUID
    name: Optional[str] = None
    email: str
    joined_at: datetime
    routines: list[RoutineAccess] = []

    model_config = ConfigDict(from_attributes=True)


class TeamListResponse(BaseModel):
    members: list[TeamMemberResponse]


class AcceptResponse(BaseModel):
    status: str
    client_name: Optional[str] = None
    client_id: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)
