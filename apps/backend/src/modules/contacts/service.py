from uuid import UUID

from .models import Contact
from .repository import ContactRepository
from .schemas import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    OrigemContato,
    SourceContactUpdate,
)


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _to_free_response(contact: Contact) -> ContactResponse:
    return ContactResponse(
        id=contact.id,
        nome=contact.nome,
        telefone=contact.telefone,
        email=contact.email,
        empresa=contact.empresa,
        origem="livre",
        tem_pessoa=True,
        updated_at=_iso(contact.updated_at),
    )


def _to_company_response(prospect, client) -> ContactResponse:
    """Linha da agenda de uma empresa (prospecto em aberto ou cliente).

    Com representante nomeado, a linha é a pessoa: `prospects.representante_*`.
    Sem representante, a linha é a própria empresa — telefone/e-mail do cadastro
    e o nome da empresa no campo `nome` — marcada com `tem_pessoa=False`, porque
    a pessoa é cadastrada no cadastro da empresa, não aqui.
    """
    empresa = (client.name if client is not None else None) or prospect.name
    tem_pessoa = bool(prospect.representante_nome)
    if tem_pessoa:
        nome = prospect.representante_nome
        telefone = prospect.representante_telefone
        email = prospect.representante_email
    else:
        nome = empresa
        telefone = (client.phone if client is not None else None) or prospect.phone
        email = (client.email if client is not None else None) or prospect.email
    return ContactResponse(
        id=prospect.id,
        nome=nome,
        telefone=telefone,
        email=email,
        empresa=empresa,
        origem="cliente" if client is not None else "prospecto",
        tem_pessoa=tem_pessoa,
        client_id=client.id if client is not None else None,
        prospect_id=prospect.id,
        updated_at=_iso(prospect.updated_at),
    )


def _to_direct_client_response(client) -> ContactResponse:
    """Cliente criado direto em Empresas: sem prospecto, logo sem representante."""
    return ContactResponse(
        id=client.id,
        nome=client.name,
        telefone=client.phone,
        email=client.email,
        empresa=client.name,
        origem="cliente",
        tem_pessoa=False,
        client_id=client.id,
        updated_at=_iso(client.updated_at),
    )


class ContactService:
    """Regras da agenda de contatos.

    Toda leitura/escrita é escopada por `user_id` aqui no service (o repository
    só recebe o id do usuário), então o router nunca decide autorização e um
    `id` enviado pelo cliente não abre acesso a dado de outra pessoa.
    """

    def __init__(self, repository: ContactRepository):
        self.repository = repository

    def list_contacts(
        self,
        user_id: UUID,
        search: str | None = None,
        origem: OrigemContato | None = None,
    ) -> list[ContactResponse]:
        """Listagem única: contatos livres + uma linha por empresa do usuário.

        "Empresa" aqui é o prospecto (em aberto ou convertido) e o cliente
        cadastrado direto: quem tem representante nomeado traz a pessoa, quem não
        tem traz o próprio contato da empresa. Prospecto/cliente arquivado
        continua na lista.

        A ordem é feita em Python (lower + origem) para não depender do
        collation do banco e ser determinística entre Postgres e SQLite.
        """
        rows: list[ContactResponse] = []
        if origem in (None, "livre"):
            rows += [
                _to_free_response(c) for c in self.repository.list_free(user_id, search)
            ]
        if origem in (None, "prospecto", "cliente"):
            companies = [
                _to_company_response(prospect, client)
                for prospect, client in self.repository.list_prospect_contacts(
                    user_id, search
                )
            ]
            rows += [row for row in companies if origem is None or row.origem == origem]
        if origem in (None, "cliente"):
            rows += [
                _to_direct_client_response(c)
                for c in self.repository.list_direct_clients(user_id, search)
            ]
        return sorted(rows, key=lambda row: (row.nome.lower(), row.origem))

    def create_contact(
        self, contact_in: ContactCreate, user_id: UUID
    ) -> ContactResponse:
        return _to_free_response(self.repository.create(contact_in, user_id))

    def update_contact(
        self, contact_id: UUID, contact_in: ContactUpdate, user_id: UUID
    ) -> ContactResponse:
        contact = self.repository.get_by_id(contact_id, user_id)
        if not contact:
            raise ValueError("Contato não encontrado")
        return _to_free_response(self.repository.update(contact, contact_in))

    def delete_contact(self, contact_id: UUID, user_id: UUID) -> None:
        contact = self.repository.get_by_id(contact_id, user_id)
        if not contact:
            raise ValueError("Contato não encontrado")
        self.repository.soft_delete(contact)

    def update_source_contact(
        self, prospect_id: UUID, data: SourceContactUpdate, user_id: UUID
    ) -> ContactResponse:
        """Corrige o contato no cadastro de origem (sem duplicar).

        Serve para as duas origens: o prospecto em aberto e o cliente (o
        representante do cliente é o do prospecto que o originou). Empresa sem
        representante nomeado não tem o que editar por aqui → 404.
        """
        source = self.repository.get_source_prospect(prospect_id, user_id)
        if not source:
            raise ValueError(
                "Cadastro sem contato (representante) cadastrado ou não encontrado"
            )
        prospect, client = source
        updated = self.repository.update_source_contact(prospect, data)
        return _to_company_response(updated, client)
