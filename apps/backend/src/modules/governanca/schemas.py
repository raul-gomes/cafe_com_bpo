from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DealProposal(BaseModel):
    id: UUID
    client_name: str | None = None
    number: int | None = None
    final_price: float | None = None
    created_at: datetime | None = None


class DealContract(BaseModel):
    id: UUID
    number: int | None = None
    status: str
    finalized_at: datetime | None = None
    created_at: datetime | None = None


class TimelineEvent(BaseModel):
    type: str
    label: str
    date: datetime | None = None
    mock: bool = False


class Deal(BaseModel):
    id: UUID
    name: str
    cnpj: str | None = None
    segment: str | None = None
    color: str | None = None
    city: str | None = None
    state: str | None = None
    email: str | None = None
    phone: str | None = None
    description: str | None = None
    representante_nome: str | None = None
    representante_cargo: str | None = None
    representante_email: str | None = None
    representante_telefone: str | None = None
    representante_cpf: str | None = None

    status: str
    reference_date: datetime
    client_id: UUID | None = None
    proposal: DealProposal | None = None
    contract: DealContract | None = None
    timeline: list[TimelineEvent] = []


class GovernancaResponse(BaseModel):
    months: list[str]
    deals: list[Deal]
