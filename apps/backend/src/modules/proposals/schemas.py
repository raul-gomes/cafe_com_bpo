from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ProposalCreate(BaseModel):
    client_name: str
    input_payload: dict
    result_payload: dict


class ProposalResponse(BaseModel):
    id: UUID
    client_name: str
    input_payload: dict
    result_payload: dict
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProposalUpdate(BaseModel):
    client_name: str | None = None
    input_payload: dict | None = None
    result_payload: dict | None = None
