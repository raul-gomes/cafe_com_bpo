from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

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
