from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DealProposal(BaseModel):
    """Último orçamento do negócio.

    `client_name` saiu (2026-10-02): a tela mostra o nome do negócio, então o do
    orçamento era o mesmo texto duplicado. O Zod da Governança é `.strict()`, e
    mandar a chave derrubava a página inteira com "Unrecognized key".
    """

    id: UUID
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


class DealAppearance(BaseModel):
    """Um mês em que o negócio aparece na Governança, e a tag que ele carrega.

    A tag é do **mês**, não do negócio: um negócio capturado aparece como
    `em_negociacao` no mês em que a prospecção começou e como `conquistado` no mês
    em que fechou (regra do dono, 2026-10-01).
    """

    month: str
    status: str


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

    appearances: list[DealAppearance] = []
    proposal: DealProposal | None = None
    contract: DealContract | None = None
    timeline: list[TimelineEvent] = []


class GovernancaResponse(BaseModel):
    months: list[str]
    deals: list[Deal]
