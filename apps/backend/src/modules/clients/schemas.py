from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID
from datetime import datetime

class ClientBase(BaseModel):
    name: str
    cnpj: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(ClientBase):
    name: Optional[str] = None

class ClientResponse(ClientBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
