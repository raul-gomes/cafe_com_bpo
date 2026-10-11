import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

OrigemContato = Literal["livre", "prospecto", "cliente"]


def clean_person_name(value: str | None) -> str:
    """Person name: required, with leading/trailing whitespace stripped."""
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("Informe o nome do contato")
    return cleaned


def clean_company_name(value: str | None) -> str | None:
    """Company name is optional: blank becomes None (never an empty string)."""
    cleaned = (value or "").strip()
    return cleaned or None


def clean_phone(value: str | None) -> str | None:
    """Phone keeps digits only — same rule as prospects/companies."""
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

    _clean_name = field_validator("nome")(clean_person_name)
    _clean_company = field_validator("empresa")(clean_company_name)
    _clean_phone = field_validator("telefone")(clean_phone)


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    """Edit of a contact, either a free one or the person of a company.

    One route for both, because what is edited is the same `contacts` row.
    `empresa` only applies to a **free** contact (the name written down by the
    BPO); on a company person it is ignored, because there the name belongs to
    the company record.
    """

    nome: str | None = Field(default=None, min_length=1, max_length=255)
    telefone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    cargo: str | None = Field(default=None, max_length=100)
    empresa: str | None = Field(default=None, max_length=255)

    _clean_name = field_validator("nome")(clean_person_name)
    _clean_company = field_validator("empresa")(clean_company_name)
    _clean_phone = field_validator("telefone")(clean_phone)


class ContactResponse(BaseModel):
    """One row of the contact agenda.

    `origem` says where the row comes from. `tem_pessoa` is False when the
    company has no named person — the row then carries the company record's own
    phone/email, `nome` shows the company, and the row is not editable here (the
    person is registered in the company record).

    Rule §6 (AGENTS): only what the frontend renders ships. `client_id` and
    `prospect_id` were dropped — no page reads them, and the company is reached
    by id, not by a duplicate of that id in this payload.
    """

    id: UUID
    nome: str
    telefone: str | None
    email: str | None
    empresa: str | None
    origem: OrigemContato
    tem_pessoa: bool = True
