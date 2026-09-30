import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

OrigemContato = Literal["livre", "prospecto", "cliente"]


def clean_nome(value: str | None) -> str:
    """Nome da pessoa: obrigatório, sem espaços nas pontas."""
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("Informe o nome do contato")
    return cleaned


def clean_empresa(value: str | None) -> str | None:
    """Nome da empresa é opcional: em branco vira None (não string vazia)."""
    cleaned = (value or "").strip()
    return cleaned or None


def clean_telefone(value: str | None) -> str | None:
    """Telefone só com dígitos — mesma regra de prospects/clientes."""
    if value is None or not value.strip():
        return None
    cleaned = re.sub(r"\D", "", value)
    if not cleaned:
        raise ValueError("Informe um telefone válido")
    return cleaned


class ContactBase(BaseModel):
    nome: str = Field(min_length=1, max_length=255)
    telefone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    empresa: str | None = Field(default=None, max_length=255)

    _nome = field_validator("nome")(clean_nome)
    _empresa = field_validator("empresa")(clean_empresa)
    _telefone = field_validator("telefone")(clean_telefone)


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    """Edição de um contato, livre ou pessoa de uma empresa (Fase 4).

    Uma rota só para os dois, porque o que se edita é o mesmo `contacts`. O
    `empresa` só tem efeito em contato **livre** (é o nome anotado no papel);
    na pessoa da empresa ele é recusado, porque ali o nome vem do cadastro.
    """

    nome: str | None = Field(default=None, min_length=1, max_length=255)
    telefone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    cargo: str | None = Field(default=None, max_length=100)
    empresa: str | None = Field(default=None, max_length=255)

    _nome = field_validator("nome")(clean_nome)
    _empresa = field_validator("empresa")(clean_empresa)
    _telefone = field_validator("telefone")(clean_telefone)


class ContactResponse(BaseModel):
    """Linha da listagem: contato livre, contato de prospecto ou de cliente.

    `origem` diz de onde a linha vem. `tem_pessoa` é False quando a empresa não
    tem representante nomeado — nesse caso a linha usa o telefone/e-mail do
    próprio cadastro da empresa, o campo `nome` mostra a empresa e a linha não
    é editável aqui (a pessoa é cadastrada no cadastro da empresa).
    """

    id: UUID
    nome: str
    telefone: str | None
    email: str | None
    empresa: str | None
    origem: OrigemContato
    tem_pessoa: bool = True
    client_id: UUID | None = None
    prospect_id: UUID | None = None
    updated_at: str | None = None
