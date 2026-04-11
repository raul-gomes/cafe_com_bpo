from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID

class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="E-mail principal do usuário.")
    password: str = Field(..., min_length=8, description="Senha forte.")
    name: Optional[str] = Field(default=None, max_length=150, description="Nome completo do usuário.")
    company: Optional[str] = Field(default=None, max_length=150, description="Empresa do usuário.")

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: Optional[str] = None
    company: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
