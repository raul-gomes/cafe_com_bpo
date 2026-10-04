from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateCustomerInput(BaseModel):
    """Customer data sent to Asaas when the user has no customer id yet."""

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
    """Charge data accepted from the client.

    `amount` must be positive and `due_date` is a real date, not free text: both
    arrive from the browser, and an unvalidated value reached Asaas (and the
    `payments` row) as typed.
    """

    amount: float = Field(gt=0)
    description: str | None = None
    payment_method: str
    due_date: date
    success_url: str | None = None
    error_url: str | None = None


class CreatePaymentRequest(BaseModel):
    """Body of `POST /payments/create`.

    The route used to take a bare `dict` and unpack it by hand, so a malformed
    body became a 400 carrying the internal exception text instead of a 422.
    """

    payment: CreatePaymentInput
    customer: CreateCustomerInput


class PaymentResponse(BaseModel):
    """Charge as rendered by the payments screen."""

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
