from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated, List
from sqlalchemy.orm import Session
from src.database import get_db_session
from src.schemas import ProposalCreate, ProposalResponse, UserResponse
from src.repositories import PricingScenarioRepository
from src.auth import get_current_user
from src.logger_config import log

router = APIRouter(prefix="/api/proposals", tags=["proposals"])

def get_repo(session: Annotated[Session, Depends(get_db_session)]) -> PricingScenarioRepository:
    return PricingScenarioRepository(session)

RepoDep = Annotated[PricingScenarioRepository, Depends(get_repo)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]

@router.post("/", response_model=ProposalResponse, status_code=201)
def create_proposal(
    proposal: ProposalCreate,
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """
    Salva uma nova proposta comercial vinculada ao usuário logado.
    """
    try:
        new_scenario = repo.create_scenario(
            user_id=current_user.id,
            client_name=proposal.client_name,
            input_payload=proposal.input_payload,
            result_payload=proposal.result_payload
        )
        repo.session.commit()
        log.info(f"📄 Proposta salva: '{proposal.client_name}' | ID: {new_scenario.id} | Usuário: {current_user.email}")
        return new_scenario
    except Exception as e:
        repo.session.rollback()
        log.error(f"❌ Erro ao salvar proposta para {current_user.email}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[ProposalResponse])
def list_proposals(
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """
    Lista todas as propostas salvas do usuário logado.
    """
    proposals = repo.list_scenarios_by_user(current_user.id)
    log.debug(f"📋 Usuário {current_user.email} listou seu histórico ({len(proposals)} itens)")
    return proposals

@router.get("/{proposal_id}", response_model=ProposalResponse)
def get_proposal(
    proposal_id: str,
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """
    Retorna os detalhes de uma proposta específica do usuário.
    """
    import uuid
    scenario = repo.get_scenario_by_id(
        user_id=current_user.id,
        scenario_id=uuid.UUID(proposal_id)
    )
    if not scenario:
        log.warning(f"🕵️ Tentativa de acesso a proposta inexistente ou IDOR: {proposal_id} por {current_user.email}")
        raise HTTPException(status_code=404, detail="Proposta não encontrada")
    
    log.debug(f"🔍 Proposta visualizada: {proposal_id} ({scenario.client_name})")
    return scenario

@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(
    proposal_id: str,
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """
    Remove uma proposta do histórico do usuário.
    """
    import uuid
    success = repo.delete_scenario(
        user_id=current_user.id,
        scenario_id=uuid.UUID(proposal_id)
    )
    if not success:
        log.warning(f"⚠️ Falha na exclusão (não encontrado ou IDOR): {proposal_id} por {current_user.email}")
        raise HTTPException(status_code=404, detail="Proposta não encontrada ou acesso negado")
    
    repo.session.commit()
    log.info(f"🗑️ Proposta excluída: {proposal_id} por {current_user.email}")
    return None
