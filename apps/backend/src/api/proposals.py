from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated, List
from sqlalchemy.orm import Session
from src.database import get_db_session
from src.schemas import ProposalCreate, ProposalResponse, UserResponse
from src.repositories import PricingScenarioRepository
from src.auth import get_current_user

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
        return new_scenario
    except Exception as e:
        repo.session.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[ProposalResponse])
def list_proposals(
    repo: RepoDep,
    current_user: CurrentUserDep
):
    """
    Lista todas as propostas salvas do usuário logado.
    """
    return repo.list_scenarios_by_user(current_user.id)
