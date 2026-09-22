from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ContractSection(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = ""


class ContractTemplateResponse(BaseModel):
    id: UUID
    sections: list[ContractSection]
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContractTemplateUpdate(BaseModel):
    sections: list[ContractSection]


class ContractGenerate(BaseModel):
    prospect_id: UUID
    proposal_id: UUID | None = None


class ContractUpdate(BaseModel):
    sections: list[ContractSection]


class ContractResponse(BaseModel):
    id: UUID
    prospect_id: UUID | None = None
    proposal_id: UUID | None = None
    client_name: str
    sections: list[ContractSection]
    status: str
    finalized_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContractFinalizeResponse(BaseModel):
    contract_id: UUID
    client_id: UUID | None = None
