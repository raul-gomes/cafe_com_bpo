from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class InviteCreate(BaseModel):
    email: str
    template_ids: list[UUID]


class InviteResponse(BaseModel):
    invitation_id: UUID
    status: str = "pending"

    model_config = ConfigDict(from_attributes=True)


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
