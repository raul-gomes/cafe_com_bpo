from uuid import UUID

from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)

from .models import Contact
from .repository import ContactRepository
from .schemas import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    OrigemContato,
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


# `companies.type` é o discriminador técnico ("client"/"prospect"); a API fala
# português. O mapeamento fica num lugar só para a agenda não ter duas vozes
# sobre o mesmo campo.
ORIGEM_POR_TYPE = {COMPANY_TYPE_CLIENT: "cliente", COMPANY_TYPE_PROSPECT: "prospecto"}


def _origem_da_empresa(company: Company) -> OrigemContato:
    return ORIGEM_POR_TYPE[company.type]


def _to_company_contact_response(contact: Contact, company: Company) -> ContactResponse:
    """Linha da agenda de uma empresa COM pessoa cadastrada.

    A linha **é** o contato: `id` é o id do contato — é o que o
    `PATCH /contacts/{id}` edita — e os dados vêm dele, não das colunas
    `representante_*`, que a Fase 4 está esvaziando. `empresa` é o nome do
    cadastro, que só muda no cadastro da empresa (regra §13).
    """
    return ContactResponse(
        id=contact.id,
        nome=contact.nome,
        telefone=contact.telefone,
        email=contact.email,
        empresa=company.name,
        origem=_origem_da_empresa(company),
        tem_pessoa=True,
        client_id=company.id if company.type == COMPANY_TYPE_CLIENT else None,
        prospect_id=company.id if company.type == COMPANY_TYPE_PROSPECT else None,
        updated_at=_iso(contact.updated_at),
    )


def _to_company_fallback_response(company: Company) -> ContactResponse:
    """Linha da empresa SEM contato ativo: o próprio cadastro, sem pessoa.

    Regra §13: empresa sem representante nomeado aparece na agenda com nome,
    telefone e e-mail do cadastro, marcada como "sem pessoa cadastrada"
    (`tem_pessoa=False`) e não editável por aqui — a pessoa é cadastrada no
    cadastro da empresa. Vale tanto para prospecto quanto para cliente: as duas
    são `companies`, e a linha nasce da empresa, não de `prospects`/`clients`.
    """
    return ContactResponse(
        id=company.id,
        nome=company.name,
        telefone=company.phone,
        email=company.email,
        empresa=company.name,
        origem=_origem_da_empresa(company),
        tem_pessoa=False,
        client_id=company.id if company.type == COMPANY_TYPE_CLIENT else None,
        prospect_id=company.id if company.type == COMPANY_TYPE_PROSPECT else None,
        updated_at=_iso(company.updated_at),
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

        A linha da empresa é o `Contact` — a pessoa, com o id do contato — ou,
        quando a empresa não tem contato ativo, a própria empresa sem pessoa.
        Prospecto/cliente arquivado continua na lista: o filtro é `is_active` do
        **contato**, não da empresa (regra §13).

        A ordem é feita em Python (lower + origem) para não depender do
        collation do banco e ser determinística entre Postgres e SQLite.
        """
        rows: list[ContactResponse] = []
        if origem in (None, "livre"):
            rows += [
                _to_free_response(c) for c in self.repository.list_free(user_id, search)
            ]
        if origem in (None, "prospecto", "cliente"):
            rows += [
                _to_company_contact_response(contact, company)
                for contact, company in self.repository.list_company_contacts(
                    user_id, search
                )
            ]
            rows += [
                _to_company_fallback_response(company)
                for company in self.repository.list_companies_without_contact(
                    user_id, search
                )
            ]
            rows = [row for row in rows if origem is None or row.origem == origem]
        return sorted(rows, key=lambda row: (row.nome.lower(), row.origem))

    def create_contact(
        self, contact_in: ContactCreate, user_id: UUID
    ) -> ContactResponse:
        return _to_free_response(self.repository.create(contact_in, user_id))

    def update_contact(
        self, contact_id: UUID, contact_in: ContactUpdate, user_id: UUID
    ) -> ContactResponse:
        """Corrige um contato pelo seu id: livre, ou a pessoa de uma empresa.

        Pessoa de empresa: o contato é a fonte (Fase 4), então a correção vem
        nele e sai espelhada nas colunas `representante_*` do prospecto de
        origem, que os consumidores legados ainda leem. Contato livre: só ele
        mesmo. Nos dois, `empresa` é ignorado — o nome da empresa é do cadastro
        (regra §13).

        Empresa sem pessoa cadastrada não tem contato, e por isso não tem id
        para ser editada por aqui: a linha dela na agenda é a própria empresa e
        fica somente leitura, como a regra manda.
        """
        contact = self.repository.get_by_id(contact_id, user_id)
        if not contact:
            raise ValueError("Contato não encontrado")
        if contact.company_id is None:
            return _to_free_response(self.repository.update(contact, contact_in))
        company = self.repository.get_company(contact.company_id, user_id)
        if company is None:
            raise ValueError("Contato não encontrado")
        data = contact_in.model_dump(exclude_unset=True)
        data.pop("empresa", None)
        updated = self.repository.update_company_contact(contact, company, data)
        return _to_company_contact_response(updated, company)

    def delete_contact(self, contact_id: UUID, user_id: UUID) -> None:
        contact = self.repository.get_by_id(contact_id, user_id)
        if not contact:
            raise ValueError("Contato não encontrado")
        self.repository.soft_delete(contact)
