from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="E-mail principal do usuário.")
    password: str = Field(..., min_length=8, description="Senha forte.")
    name: Optional[str] = Field(
        default=None, max_length=150, description="Nome completo do usuário."
    )
    company: Optional[str] = Field(
        default=None, max_length=150, description="Empresa do usuário."
    )


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: Optional[str] = None
    company: Optional[str] = None
    company_name: Optional[str] = None
    company_segment: Optional[str] = None
    company_description: Optional[str] = None
    avatar_url: str | None = None
    role: str = "user"
    whatsapp: Optional[str] = None
    company_razao_social: Optional[str] = None
    company_nome_fantasia: Optional[str] = None
    company_cnpj: Optional[str] = None
    company_address: Optional[str] = None
    company_professional_email: Optional[str] = None
    company_commercial_phone: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_color_code: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    company_name: Optional[str] = None
    company_segment: Optional[str] = None
    company_description: Optional[str] = None
    whatsapp: Optional[str] = None
    company_razao_social: Optional[str] = None
    company_nome_fantasia: Optional[str] = None
    company_cnpj: Optional[str] = None
    company_address: Optional[str] = None
    company_professional_email: Optional[str] = None
    company_commercial_phone: Optional[str] = None
    company_logo_url: Optional[str] = None
    company_color_code: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="E-mail da conta.")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Token de redefinição.")
    new_password: str = Field(..., min_length=8, description="Nova senha.")
