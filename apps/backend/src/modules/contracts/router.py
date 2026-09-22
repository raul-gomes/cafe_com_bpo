from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.clients.repository import ClientRepository
from src.modules.contracts.repository import ContractRepository
from src.modules.contracts.schemas import (
    ContractFinalizeResponse,
    ContractGenerate,
    ContractResponse,
    ContractTemplateResponse,
    ContractTemplateUpdate,
    ContractUpdate,
)
from src.modules.contracts.service import ContractService
from src.modules.proposals.repository import PricingScenarioRepository
from src.modules.prospects.repository import ProspectRepository
from src.modules.prospects.service import ProspectService

router = APIRouter(prefix="/contracts", tags=["contracts"])


def get_contract_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ContractRepository:
    return ContractRepository(session)


def get_client_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ClientRepository:
    return ClientRepository(session)


def get_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> ContractService:
    return ContractService(
        repository=ContractRepository(session),
        prospect_service=ProspectService(ProspectRepository(session)),
        proposal_repo=PricingScenarioRepository(session),
    )


ContractRepoDep = Annotated[ContractRepository, Depends(get_contract_repository)]
ClientRepoDep = Annotated[ClientRepository, Depends(get_client_repository)]
ServiceDep = Annotated[ContractService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/templates", response_model=ContractTemplateResponse)
def get_template(service: ServiceDep, current_user: CurrentUserDep):
    """Retorna o contrato padrão (modelo) do usuário; cria vazio se não existir."""
    template = service.get_template(current_user.id)
    log.debug(
        f"📄 Modelo de contrato consultado por {current_user.email} "
        f"({len(template.sections or [])} seções)"
    )
    return template


@router.put("/templates", response_model=ContractTemplateResponse)
def update_template(
    payload: ContractTemplateUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Atualiza o contrato padrão do usuário."""
    template = service.update_template(current_user.id, payload.sections)
    log.info(
        f"📝 Modelo de contrato atualizado por {current_user.email} "
        f"({len(payload.sections)} seções)"
    )
    return template


@router.post("/generate", response_model=ContractResponse, status_code=201)
def generate_contract(
    payload: ContractGenerate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Gera um novo contrato a partir do modelo padrão do usuário.

    Copia as seções do modelo e substitui os placeholders `{{token}}`
    pelos dados do prospecto (e do orçamento, se vinculado).
    """
    try:
        contract = service.generate_contract(
            user_id=current_user.id,
            prospect_id=payload.prospect_id,
            proposal_id=payload.proposal_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    log.info(
        f"📄 Contrato gerado para '{contract.client_name}' por {current_user.email}"
    )
    return contract


@router.get("/", response_model=list[ContractResponse])
def list_contracts(repo: ContractRepoDep, current_user: CurrentUserDep):
    contracts = repo.list_contracts(current_user.id)
    log.debug(f"📋 Usuário {current_user.email} listou {len(contracts)} contratos")
    return contracts


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: UUID, repo: ContractRepoDep, current_user: CurrentUserDep
):
    contract = repo.get_contract(current_user.id, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    return contract


@router.patch("/{contract_id}", response_model=ContractResponse)
def update_contract(
    contract_id: UUID,
    payload: ContractUpdate,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    try:
        contract = service.update_contract(
            current_user.id, contract_id, payload.sections
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    log.info(f"📝 Contrato {contract_id} atualizado por {current_user.email}")
    return contract


@router.post("/{contract_id}/finalize", response_model=ContractFinalizeResponse)
def finalize_contract(
    contract_id: UUID,
    service: ServiceDep,
    client_repo: ClientRepoDep,
    current_user: CurrentUserDep,
):
    """Finaliza o contrato (torna-o imutável) e converte o prospecto em Cliente."""
    try:
        contract, client_id = service.finalize(
            current_user.id, contract_id, client_repo=client_repo
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    log.info(
        f"🔒 Contrato {contract_id} finalizado por {current_user.email} "
        f"(prospecto convertido)"
    )
    return ContractFinalizeResponse(contract_id=contract.id, client_id=client_id)


@router.delete("/{contract_id}", status_code=204)
def delete_contract(
    contract_id: UUID,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    try:
        service.delete(current_user.id, contract_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except PermissionError as e:
        raise HTTPException(status_code=409, detail=str(e)) from e

    log.info(f"🗑️ Contrato {contract_id} arquivado por {current_user.email}")
