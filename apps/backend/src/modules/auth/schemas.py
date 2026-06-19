from pydantic import BaseModel, Field, EmailStr
from typing import Optional, TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from .models import User


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
    company_color_secondary: Optional[str] = None

    @classmethod
    def from_user(cls, user: "User") -> "UserResponse":
        """Construct a UserResponse from a User ORM model."""
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            company=user.company,
            company_name=user.company_name,
            company_segment=user.company_segment,
            company_description=user.company_description,
            avatar_url=user.avatar_file.read_url
            if user.avatar_file
            else user.avatar_url,
            role=user.role,
            whatsapp=user.whatsapp,
            company_razao_social=user.company_razao_social,
            company_nome_fantasia=user.company_nome_fantasia,
            company_cnpj=user.company_cnpj,
            company_address=user.company_address,
            company_professional_email=user.company_professional_email,
            company_commercial_phone=user.company_commercial_phone,
            company_logo_url=user.company_logo_url,
            company_color_code=user.company_color_code,
            company_color_secondary=user.company_color_secondary,
        )


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
    company_color_secondary: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str | None = None  # deprecated — now set as httpOnly cookie


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None  # optional — may come from httpOnly cookie


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="E-mail da conta.")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Token de redefinição.")
    new_password: str = Field(..., min_length=8, description="Nova senha.")
    email: EmailStr | None = Field(
        default=None,
        description="E-mail da conta (opcional — verifica se o token pertence ao dono do e-mail).",
    )
