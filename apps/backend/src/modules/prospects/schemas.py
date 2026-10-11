import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from src.core.validators import validate_cep, validate_cnpj


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
        return validate_cnpj(v)

    @field_validator("cep")
    @classmethod
    def sanitize_cep(cls, v: str | None) -> str | None:
        return validate_cep(v)

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


class ProspectResponse(BaseModel):
    """Prospecto como a tela de prospecção renderiza — lido de `companies`.

    DTO escrito à mão (não herda `ProspectBase`, §6): a resposta nascia com 26
    chaves e nenhuma delas mudava a tela. Fora, porque nenhum componente lê:

    - `user_id`: a rota já devolve só as empresas do próprio usuário;
    - `created_at`/`updated_at`: auditoria, que a tela não mostra;
    - `converted_at`/`reproved_at`/`converted_client_id`: as flags do ciclo de
      vida, que já filtram a listagem no servidor — um prospecto convertido ou
      não captado nem chega aqui, então devolvê-las era informação que a tela
      não tinha como usar.

    O representante (`representante_*`) **fica**, com o nome de payload atual:
    o card mostra nome/cpf/cargo e o formulário de edição preenche os cinco.
    O valor vem do contato (fonte única, Fase 4) com as colunas legadas como
    fallback enquanto elas existirem.
    """

    id: UUID
    name: str
    cnpj: str | None = None
    phone: str | None = None
    email: str | None = None
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
    representante_nome: str | None = None
    representante_email: str | None = None
    representante_cpf: str | None = None
    representante_telefone: str | None = None
    representante_cargo: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ProspectConvertResponse(BaseModel):
    prospect_id: UUID
    client_id: UUID
