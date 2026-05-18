from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class CreateCustomerInput(BaseModel):
    name: str
    email: str
    cpf_cnpj: Optional[str] = None
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    address: Optional[str] = None
    address_number: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None


class CreatePaymentInput(BaseModel):
    amount: float
    description: Optional[str] = None
    payment_method: str
    due_date: str
    success_url: Optional[str] = None
    error_url: Optional[str] = None


class PaymentResponse(BaseModel):
    id: UUID
    user_id: UUID
    asaas_customer_id: Optional[str] = None
    asaas_payment_id: Optional[str] = None
    amount: float
    description: Optional[str] = None
    status: str
    payment_method: str
    due_date: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AsaasPaymentLink(BaseModel):
    payment_id: UUID
    asaas_payment_id: str
    invoice_url: str
    boleto_url: Optional[str] = None
    pix_qr_code: Optional[str] = None
    pix_copia_cola: Optional[str] = None
