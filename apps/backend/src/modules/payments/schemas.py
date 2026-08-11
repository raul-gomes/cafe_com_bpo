from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CreateCustomerInput(BaseModel):
    name: str
    email: str
    cpf_cnpj: str | None = None
    phone: str | None = None
    mobile_phone: str | None = None
    address: str | None = None
    address_number: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None


class CreatePaymentInput(BaseModel):
    amount: float
    description: str | None = None
    payment_method: str
    due_date: str
    success_url: str | None = None
    error_url: str | None = None


class PaymentResponse(BaseModel):
    id: UUID
    user_id: UUID
    asaas_customer_id: str | None = None
    asaas_payment_id: str | None = None
    amount: float
    description: str | None = None
    status: str
    payment_method: str
    due_date: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AsaasPaymentLink(BaseModel):
    payment_id: UUID
    asaas_payment_id: str
    invoice_url: str
    boleto_url: str | None = None
    pix_qr_code: str | None = None
    pix_copia_cola: str | None = None
