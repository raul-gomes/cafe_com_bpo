import re
from typing import TYPE_CHECKING
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

if TYPE_CHECKING:
    from .models import User


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="E-mail principal do usuário.")
    password: str = Field(..., min_length=8, description="Senha forte.")
    name: str | None = Field(
        default=None, max_length=150, description="Nome completo do usuário."
    )
    company: str | None = Field(
        default=None, max_length=150, description="Empresa do usuário."
    )

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str | None = None
    company: str | None = None
    company_name: str | None = None
    company_segment: str | None = None
    company_description: str | None = None
    avatar_url: str | None = None
    role: str = "user"
    whatsapp: str | None = None
    company_razao_social: str | None = None
    company_nome_fantasia: str | None = None
    company_cnpj: str | None = None
    company_address: str | None = None
    company_professional_email: str | None = None
    company_commercial_phone: str | None = None
    company_logo_url: str | None = None
    company_color_code: str | None = None
    company_color_secondary: str | None = None

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
    name: str | None = None
    company: str | None = None
    company_name: str | None = None
    company_segment: str | None = None
    company_description: str | None = None
    whatsapp: str | None = None
    company_razao_social: str | None = None
    company_nome_fantasia: str | None = None
    company_cnpj: str | None = None
    company_address: str | None = None
    company_professional_email: str | None = None
    company_commercial_phone: str | None = None
    company_logo_url: str | None = None
    company_color_code: str | None = None
    company_color_secondary: str | None = None

    @field_validator("whatsapp", "company_commercial_phone")
    @classmethod
    def sanitize_phone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        cleaned = re.sub(r"\D", "", v)
        if not cleaned:
            raise ValueError("Informe um telefone válido")
        return cleaned

    @field_validator("company_cnpj")
    @classmethod
    def sanitize_cnpj(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return v
        cleaned = re.sub(r"\D", "", v)
        if not cleaned:
            raise ValueError("Informe um CNPJ válido")
        return cleaned


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    refresh_token: str | None = None  # deprecated — now set as httpOnly cookie


class UserLookupRequest(BaseModel):
    emails: list[str]


class UserLookupItem(BaseModel):
    email: str
    name: str | None = None
    avatar_url: str | None = None


class UserLookupResponse(BaseModel):
    found: list[UserLookupItem]
    not_found: list[str]


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None  # optional — may come from httpOnly cookie


class ForgotPasswordRequest(BaseModel):
    email: EmailStr = Field(..., description="E-mail da conta.")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Token de redefinição.")
    new_password: str = Field(..., min_length=8, description="Nova senha.")
    email: EmailStr | None = Field(
        default=None,
        description="E-mail da conta (opcional — verifica se o token pertence ao dono do e-mail).",
    )

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return v.lower().strip()
