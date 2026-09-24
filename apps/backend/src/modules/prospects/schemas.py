import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class ProspectBase(BaseModel):
    name: str
    cnpj: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    color: str | None = None
    description: str | None = None
    segment: str | None = None
    representante_nome: str | None = None
    representante_email: EmailStr | None = None
    representante_cpf: str | None = None
    representante_telefone: str | None = None
    representante_cargo: str | None = None
    street: str | None = None
    number: str | None = None
    complement: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    cep: str | None = None

    @field_validator("phone", "representante_telefone")
    @classmethod
    def sanitize_phone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        cleaned = re.sub(r"\D", "", v)
        if not cleaned:
            raise ValueError("Informe um telefone válido")
        return cleaned

    @field_validator("cnpj")
    @classmethod
    def sanitize_cnpj(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        cleaned = re.sub(r"\D", "", v)
        if not cleaned:
            raise ValueError("Informe um CNPJ válido")
        return cleaned

    @field_validator("representante_cpf")
    @classmethod
    def sanitize_representante_cpf(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        cleaned = re.sub(r"\D", "", v)
        if not cleaned:
            raise ValueError("Informe um CPF válido")
        return cleaned


class ProspectCreate(ProspectBase):
    pass


class ProspectUpdate(ProspectBase):
    name: str | None = None


class ProspectResponse(ProspectBase):
    id: UUID
    user_id: UUID
    converted_client_id: UUID | None = None
    converted_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProspectConvertResponse(BaseModel):
    prospect_id: UUID
    client_id: UUID
