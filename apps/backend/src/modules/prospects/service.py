from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from src.modules.clients.schemas import ClientCreate
from src.modules.companies.models import Company
from src.modules.companies.repository import CompanyRepository
from src.modules.contacts.repository import ContactRepository
from src.modules.prospects.models import Prospect
from src.modules.prospects.repository import (
    REPRESENTANTE_FIELDS,
    ProspectRepository,
)
from src.modules.prospects.schemas import ProspectConvertResponse, ProspectResponse


class ProspectService:
    """Service layer for prospect operations."""

    def __init__(
        self,
        repository: ProspectRepository,
        companies: CompanyRepository | None = None,
        contacts: ContactRepository | None = None,
    ) -> None:
        """Monta o service com a fachada de leitura da empresa.

        Args:
            repository: Repositório legado, dono da escrita e do 1:1 por id.
            companies: Leitura da `companies`; criada a partir da mesma sessão
                quando não vier por injeção.
            contacts: Leitura do contato da pessoa, em lote.
        """
        self.repository = repository
        session: Session = repository.session
        self.companies = companies or CompanyRepository(session)
        self.contacts = contacts or ContactRepository(session)

    # ── leitura read-to-render ────────────────────────────────────────────

    def list_prospects(self, user_id: UUID) -> list[ProspectResponse]:
        """Prospectos do usuário para a tela, lidos de `companies`.

        Fase 3, item 4: a listagem sai da fachada de empresa (o estágio é um
        `type` na linha única do negócio) e vira DTO escrito à mão, com só o
        que o card e o formulário de edição leem.
        """
        return self._render(self.companies.list_open_prospects(user_id))

    def render_prospect(self, prospect: Prospect) -> ProspectResponse:
        """DTO da empresa de um prospecto recém-escrito, para a resposta do comando.

        Criar, editar, reprovar e voltar à negociação respondem o mesmo DTO da
        listagem — montado pela empresa, com o contato da pessoa — para que a
        tela não receba duas formas do mesmo dado depois de salvar.
        """
        company = self.companies.session.get(Company, prospect.id)
        if company is None:
            # Defensivo: empresa sem linha (ou colapsada na conversão). O
            # cadastro legado ainda é a única cópia dos cadastrais, então a
            # resposta sai dele em vez de quebrar o comando.
            return ProspectResponse.model_validate(prospect)
        return self._render([company], legacy={company.id: prospect})[0]

    def _render(
        self, companies: list[Company], legacy: dict[UUID, Prospect] | None = None
    ) -> list[ProspectResponse]:
        """Monta os DTOs de uma lista de empresas, com o contato em lote.

        Args:
            companies: Empresas a renderizar, já filtradas e ordenadas.
            legacy: Prospectos legados por id, usados como fallback do
                representante das empresas sem contato ativo.

        Returns:
            Um `ProspectResponse` por empresa, na mesma ordem da entrada.
        """
        if not companies:
            return []
        por_empresa = self.contacts.list_primary_by_company_ids(
            [company.id for company in companies]
        )
        sem_contato = {
            company.id: company
            for company in companies
            if company.id not in por_empresa
        }
        legados = (
            dict(legacy) if legacy is not None else self._legacy_rows(list(sem_contato))
        )
        respostas = []
        for company in companies:
            contato = por_empresa.get(company.id)
            legado = legados.get(company.id)
            respostas.append(
                ProspectResponse(
                    id=company.id,
                    name=company.name,
                    cnpj=company.cnpj,
                    phone=company.phone,
                    email=company.email,
                    color=company.color,
                    description=company.description,
                    segment=company.segment,
                    street=company.street,
                    number=company.number,
                    complement=company.complement,
                    neighborhood=company.neighborhood,
                    city=company.city,
                    state=company.state,
                    cep=company.cep,
                    representante_nome=(
                        contato.nome
                        if contato is not None
                        else getattr(legado, "representante_nome", None)
                    ),
                    representante_email=(
                        contato.email
                        if contato is not None
                        else getattr(legado, "representante_email", None)
                    ),
                    representante_cpf=(
                        contato.cpf
                        if contato is not None
                        else getattr(legado, "representante_cpf", None)
                    ),
                    representante_telefone=(
                        contato.telefone
                        if contato is not None
                        else getattr(legado, "representante_telefone", None)
                    ),
                    representante_cargo=(
                        contato.cargo
                        if contato is not None
                        else getattr(legado, "representante_cargo", None)
                    ),
                )
            )
        return respostas

    def _legacy_rows(self, company_ids: list[UUID]) -> dict[UUID, Prospect]:
        """Lê só as colunas legadas do representante, em uma consulta.

        As colunas `representante_*` continuam em `prospects` até a migration
        destrutiva da Fase 4, e são o fallback de uma empresa sem contato
        ativo — o mesmo fallback de `contracts` e `governanca`. A consulta é
        em lote e com `load_only`: a tela não quer as outras colunas legadas.
        """
        if not company_ids:
            return {}
        session = self.repository.session
        # `load_only` exige os atributos da classe, não os nomes soltos: os
        # campos do fallback são as mesmas colunas de `REPRESENTANTE_FIELDS`.
        legado = tuple(
            getattr(Prospect, field_name) for field_name in REPRESENTANTE_FIELDS
        )
        linhas = session.scalars(
            select(Prospect)
            .options(load_only(Prospect.id, *legado))
            .where(Prospect.id.in_(company_ids))
        ).all()
        return {linha.id: linha for linha in linhas}

    # ── escrita (regra de conversão) ──────────────────────────────────────

    def get_user_prospects(self, user_id: UUID) -> list:
        """Prospectos ativos e não convertidos do usuário."""
        return self.repository.get_by_user(user_id)

    def create_prospect(self, prospect_data, user_id: UUID):
        return self.repository.create(prospect_data, user_id)

    def update_prospect(self, prospect_id: UUID, user_id: UUID, prospect_data):
        prospect = self.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found for user {user_id}")
        return self.repository.update(prospect, prospect_data)

    def delete_prospect(
        self,
        prospect_id: UUID,
        user_id: UUID,
        proposal_repo,
        contract_repo,
    ) -> None:
        """Arquiva (soft delete) o prospecto e oculta tudo o que está
        vinculado a ele para este usuário: orçamentos e contratos. O link
        público de um orçamento vinculado também deixa de valer."""
        prospect = self.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found for user {user_id}")
        self.repository.delete(prospect)
        proposal_repo.delete_by_prospect(user_id, prospect_id)
        contract_repo.delete_by_prospect(user_id, prospect_id)

    def convert_prospect(
        self,
        prospect_id: UUID,
        user_id: UUID,
        client_repo,
    ) -> ProspectConvertResponse:
        """Converte um prospecto ativo em Cliente (cadastro simples, sem time/rotinas).

        O prospecto sai da listagem ativa de prospectos e o Cliente criado carrega
        os mesmos dados cadastrais. É a única fonte da regra de conversão — quando o
        módulo de Contratos existir, `finalizar_contrato` chamará este mesmo service.
        """
        prospect = self.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError(f"Prospect {prospect_id} not found or already converted")

        client_in = ClientCreate(
            name=prospect.name,
            cnpj=prospect.cnpj,
            phone=prospect.phone,
            email=prospect.email,
            color=prospect.color,
            description=prospect.description,
            segment=prospect.segment,
            street=prospect.street,
            number=prospect.number,
            complement=prospect.complement,
            neighborhood=prospect.neighborhood,
            city=prospect.city,
            state=prospect.state,
            cep=prospect.cep,
        )
        new_client = client_repo.create(client_in, user_id)

        self.repository.mark_converted(prospect, new_client.id)

        return ProspectConvertResponse(
            prospect_id=prospect.id,
            client_id=new_client.id,
        )
