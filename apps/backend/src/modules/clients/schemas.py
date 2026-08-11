from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ClientBase(BaseModel):
    name: str
    cnpj: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    color: str | None = None
    description: str | None = None
    segment: str | None = None
    address: str | None = None


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
