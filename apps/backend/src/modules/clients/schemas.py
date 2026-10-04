import re
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

from src.core.validators import validate_cep, validate_cnpj


class ClientBase(BaseModel):
    name: str
    cnpj: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    color: str | None = None
    description: str | None = None
    segment: str | None = None
    street: str | None = None
    number: str | None = None
    complement: str | None = None
    neighborhood: str | None = None
    city: str | None = None
    state: str | None = None
    cep: str | None = None

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
        return validate_cnpj(v)

    @field_validator("cep")
    @classmethod
    def sanitize_cep(cls, v: str | None) -> str | None:
        return validate_cep(v)


class ClientCreate(ClientBase):
    pass


class ClientUpdate(ClientBase):
    name: str | None = None


class ClientResponse(ClientBase):
    """Cliente do usuário, lido da `companies` (facade).

    Contrato §6: só o que a tela de empresas renderiza. `user_id`,
    `created_at` e `updated_at` saíram — o dono já está implícito (o endpoint
    devolve apenas as empresas do próprio usuário) e nenhum componente exibe
    data de cadastro da empresa.
    """

    id: UUID

    class Config:
        from_attributes = True
