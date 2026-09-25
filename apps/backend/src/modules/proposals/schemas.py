from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProposalCreate(BaseModel):
    client_name: str
    input_payload: dict
    result_payload: dict
    prospect_id: UUID | None = None


class ProposalResponse(BaseModel):
    id: UUID
    client_name: str
    number: int | None = None
    prospect_id: UUID | None = None
    input_payload: dict
    result_payload: dict
    created_at: datetime
    public_hash_expires_at: datetime | None = None
    shared_at: datetime | None = None
    shared_count: int = 0
    client_decision: str | None = None
    client_observation: str | None = None
    client_decided_at: datetime | None = None
    decision_history: list[dict] | None = None

    model_config = ConfigDict(from_attributes=True)


class ProposalUpdate(BaseModel):
    client_name: str | None = None
    input_payload: dict | None = None
    result_payload: dict | None = None
    prospect_id: UUID | None = None


class ShareLinkResponse(BaseModel):
    url: str
    expires_at: datetime


class PublicProviderInfo(BaseModel):
    """Identidade do BPO exibida no orçamento público (logo, cores, contato)."""

    name: str | None = None
    email: str | None = None
    company_nome_fantasia: str | None = None
    company_razao_social: str | None = None
    company_logo_url: str | None = None
    avatar_url: str | None = None
    company_color_code: str | None = None
    company_color_secondary: str | None = None
    company_commercial_phone: str | None = None
    whatsapp: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PublicProposalResponse(BaseModel):
    client_name: str
    number: int | None = None
    input_payload: dict
    result_payload: dict
    created_at: datetime
    expires_at: datetime | None = None
    client_decision: str | None = None
    client_observation: str | None = None
    client_decided_at: datetime | None = None
    provider: PublicProviderInfo | None = None


class ClientDecisionRequest(BaseModel):
    decision: Literal["approved", "changes", "rejected"]
    observation: str | None = Field(default=None, max_length=2000)
