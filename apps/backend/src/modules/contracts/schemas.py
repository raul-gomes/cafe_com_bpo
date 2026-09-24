from datetime import datetime
from typing import Any
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
    fields: dict[str, Any] | None = None


class ContractUpdate(BaseModel):
    sections: list[ContractSection]


class ContractFieldsUpdate(BaseModel):
    fields: dict[str, Any]


class ContractResponse(BaseModel):
    id: UUID
    number: int | None = None
    prospect_id: UUID | None = None
    proposal_id: UUID | None = None
    client_name: str
    sections: list[ContractSection]
    fields: dict[str, Any] | None = None
    status: str
    finalized_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContractFinalizeResponse(BaseModel):
    contract_id: UUID
    client_id: UUID | None = None


class ContractPreviewResponse(BaseModel):
    sections: list[ContractSection]


class ContractMissingFieldsRequest(BaseModel):
    prospect_id: UUID
    proposal_id: UUID | None = None


class ContractFieldDescriptor(BaseModel):
    key: str
    label: str
    kind: str = "text"
    hint: str | None = None
    options: list[str] | None = None
    default: Any = None
    required: bool = False
    group: str
    list_fields: list[dict[str, Any]] | None = None
    rows: list[dict[str, Any]] | None = None


class ContractMissingFieldsResponse(BaseModel):
    fields: list[ContractFieldDescriptor]
    count: int
