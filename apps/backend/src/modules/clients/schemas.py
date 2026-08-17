import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator


class ClientBase(BaseModel):
    name: str
    cnpj: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    color: str | None = None
    description: str | None = None
    segment: str | None = None
    address: str | None = None

    @field_validator("phone")
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


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    name: str | None = None


class ClientResponse(ClientBase):
    id: UUID
    user_id: UUID
    role: str = "owner"  # "owner" | "member"
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
