from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class InviteCreate(BaseModel):
    emails: list[str]
    template_ids: list[UUID]


class InviteResult(BaseModel):
    email: str
    status: str
    invitation_id: UUID | None = None
    error: str | None = None


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
    name: str | None = None
    email: str
    joined_at: datetime
    routines: list[RoutineAccess] = []

    model_config = ConfigDict(from_attributes=True)


class TeamListResponse(BaseModel):
    members: list[TeamMemberResponse]


class AcceptResponse(BaseModel):
    status: str
    client_name: str | None = None
    client_id: UUID | None = None

    model_config = ConfigDict(from_attributes=True)
