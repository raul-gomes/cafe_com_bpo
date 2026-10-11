from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Perfil = Literal["comecando", "crescendo", "escritorio_contabil", "outro"]
FaixaClientes = Literal["0", "1-5", "6-15", "16-30", "30+"]


class BetaSignupCreate(BaseModel):
    nome: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    whatsapp: str | None = Field(None, max_length=30)
    perfil: Perfil
    faixa_clientes: FaixaClientes
    desafio: str | None = Field(None, max_length=1000)
    origem: str | None = Field(None, max_length=100)
    consentimento_lgpd: bool
    # Campo-armadilha: invisível para pessoas, robôs preenchem.
    website: str | None = Field(None, max_length=200)

    @field_validator("nome", "desafio", "origem", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", mode="after")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        return value.lower()

    @field_validator("whatsapp", mode="after")
    @classmethod
    def _digits_only(cls, value: str | None) -> str | None:
        if value is None:
            return None
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits and not 10 <= len(digits) <= 13:
            raise ValueError("WhatsApp deve ter DDD e número.")
        return digits or None

    @field_validator("consentimento_lgpd")
    @classmethod
    def _must_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("É preciso aceitar o uso dos dados (LGPD).")
        return value


class BetaSignupAccepted(BaseModel):
    """Resposta igual para inscrição nova, repetida ou de robô (não revela nada)."""

    message: str = "Inscrição recebida. Em breve a gente fala com você."


class BetaSignupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nome: str
    email: str
    whatsapp: str | None
    perfil: str
    faixa_clientes: str
    desafio: str | None
    origem: str | None
    criado_em: datetime = Field(validation_alias="created_at")
    atualizado_em: datetime = Field(validation_alias="updated_at")
