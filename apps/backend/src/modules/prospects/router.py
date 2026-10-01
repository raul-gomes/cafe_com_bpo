from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.clients.repository import ClientRepository
from src.modules.companies.repository import CompanyRepository
from src.modules.contacts.repository import ContactRepository
from src.modules.contracts.repository import ContractRepository
from src.modules.proposals.repository import PricingScenarioRepository
from src.modules.prospects.repository import ProspectRepository
from src.modules.prospects.schemas import (
    ProspectConvertResponse,
    ProspectCreate,
    ProspectResponse,
    ProspectUpdate,
)
from src.modules.prospects.service import ProspectService

router = APIRouter(prefix="/prospects", tags=["prospects"])


def get_prospect_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ProspectRepository:
    return ProspectRepository(session)


def get_company_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> CompanyRepository:
    return CompanyRepository(session)


def get_contact_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ContactRepository:
    return ContactRepository(session)


def get_client_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ClientRepository:
    return ClientRepository(session)


def get_proposal_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> PricingScenarioRepository:
    return PricingScenarioRepository(session)


def get_contract_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ContractRepository:
    return ContractRepository(session)


ProspectRepoDep = Annotated[ProspectRepository, Depends(get_prospect_repository)]
CompanyRepoDep = Annotated[CompanyRepository, Depends(get_company_repository)]
ContactRepoDep = Annotated[ContactRepository, Depends(get_contact_repository)]
ClientRepoDep = Annotated[ClientRepository, Depends(get_client_repository)]
ProposalRepoDep = Annotated[PricingScenarioRepository, Depends(get_proposal_repository)]
ContractRepoDep = Annotated[ContractRepository, Depends(get_contract_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


def _service(
    repo: ProspectRepository,
    companies: CompanyRepository,
    contacts: ContactRepository,
) -> ProspectService:
    """Monta o service com a fachada de leitura e o repositório de contatos.

    Args:
        repo: Repositório legado dos prospects.
        companies: Leitura da `companies`, dona da listagem.
        contacts: Leitura do contato da pessoa, em lote.

    Returns:
        O service pronto para ler e converter.
    """
    return ProspectService(repo, companies, contacts)


@router.get("/", response_model=list[ProspectResponse])
def get_prospects(
    repo: ProspectRepoDep,
    companies: CompanyRepoDep,
    contacts: ContactRepoDep,
    current_user: CurrentUserDep,
):
    """Prospectos em aberto do usuário atual, lidos de `companies`.

    Só entram os que ainda não viraram cliente e não estão marcados como não
    captado — quem foi aprovado ou reprovado vive na Governança.
    """
    return _service(repo, companies, contacts).list_prospects(current_user.id)


@router.post("/", response_model=ProspectResponse, status_code=status.HTTP_201_CREATED)
def create_prospect(
    prospect_in: ProspectCreate,
    repo: ProspectRepoDep,
    companies: CompanyRepoDep,
    contacts: ContactRepoDep,
    current_user: CurrentUserDep,
):
    new_prospect = repo.create(prospect_in, current_user.id)
    log.info(f"🚀 Prospecto criado: {prospect_in.name} por {current_user.email}")
    return _service(repo, companies, contacts).render_prospect(new_prospect)


@router.put("/{prospect_id}", response_model=ProspectResponse)
def update_prospect(
    prospect_id: UUID,
    prospect_in: ProspectUpdate,
    repo: ProspectRepoDep,
    companies: CompanyRepoDep,
    contacts: ContactRepoDep,
    current_user: CurrentUserDep,
):
    prospect = repo.get_by_id(prospect_id, current_user.id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado")

    updated = repo.update(prospect, prospect_in)
    return _service(repo, companies, contacts).render_prospect(updated)


@router.delete("/{prospect_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prospect(
    prospect_id: UUID,
    repo: ProspectRepoDep,
    proposal_repo: ProposalRepoDep,
    contract_repo: ContractRepoDep,
    current_user: CurrentUserDep,
):
    """Arquiva um prospecto (soft delete) e oculta do usuário os orçamentos e
    contratos vinculados a ele — inclusive o link público de orçamentos."""
    service = ProspectService(repo)
    try:
        service.delete_prospect(
            prospect_id, current_user.id, proposal_repo, contract_repo
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado") from e

    log.info(f"🗑️ Prospecto arquivado: {prospect_id} por {current_user.email}")


@router.post("/{prospect_id}/convert", response_model=ProspectConvertResponse)
def convert_prospect(
    prospect_id: UUID,
    repo: ProspectRepoDep,
    client_repo: ClientRepoDep,
    current_user: CurrentUserDep,
):
    """Converte um prospecto em Cliente após a finalização de contrato.

    Ponto único da regra de conversão: cria o Cliente com os mesmos dados
    cadastrais e remove o prospecto da listagem ativa.
    """
    service = ProspectService(repo)
    try:
        result = service.convert_prospect(prospect_id, current_user.id, client_repo)
    except ValueError as e:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado") from e

    log.info(
        f"🎯 Prospecto convertido em cliente: {prospect_id} -> {result.client_id} por {current_user.email}"
    )
    return result


@router.post("/{prospect_id}/reprove", response_model=ProspectResponse)
def reprove_prospect(
    prospect_id: UUID,
    repo: ProspectRepoDep,
    companies: CompanyRepoDep,
    contacts: ContactRepoDep,
    current_user: CurrentUserDep,
):
    """Marca um prospecto como não captado (perdido).

    Define a flag binária `reproved_at` (1 = não captado) usada pela
    Governança para separar painéis de captação. O prospecto permanece
    ativo na listagem e pode ser revertido com `unreprove`.
    """
    prospect = repo.get_by_id(prospect_id, current_user.id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado")

    if prospect.converted_client_id is not None:
        raise HTTPException(
            status_code=409, detail="Prospecto já convertido em Cliente"
        )

    updated = repo.mark_reproved(prospect)
    log.info(
        f"🚫 Prospecto marcado como não captado: {prospect_id} por {current_user.email}"
    )
    return _service(repo, companies, contacts).render_prospect(updated)


@router.post("/{prospect_id}/unreprove", response_model=ProspectResponse)
def unreprove_prospect(
    prospect_id: UUID,
    repo: ProspectRepoDep,
    companies: CompanyRepoDep,
    contacts: ContactRepoDep,
    current_user: CurrentUserDep,
):
    """Desfaz a reprovação, devolvendo o prospecto à negociação."""
    prospect = repo.get_by_id(prospect_id, current_user.id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado")

    updated = repo.clear_reproved(prospect)
    log.info(
        f"↩️ Prospecto de volta à negociação: {prospect_id} por {current_user.email}"
    )
    return _service(repo, companies, contacts).render_prospect(updated)
