from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Annotated, List
from sqlalchemy.orm import Session
import uuid

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.service import get_current_user
from src.modules.auth.schemas import UserResponse
from .schemas import ProposalCreate, ProposalResponse
from .repository import PricingScenarioRepository
from .service import ProposalService

router = APIRouter(prefix="/proposals", tags=["proposals"])


def get_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> PricingScenarioRepository:
    return PricingScenarioRepository(session)


def get_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> ProposalService:
    return ProposalService(PricingScenarioRepository(session))


RepoDep = Annotated[PricingScenarioRepository, Depends(get_repo)]
ServiceDep = Annotated[ProposalService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/", response_model=ProposalResponse, status_code=201)
def create_proposal(
    proposal: ProposalCreate, repo: RepoDep, current_user: CurrentUserDep
):
    try:
        new_scenario = repo.create_scenario(
            user_id=current_user.id,
            client_name=proposal.client_name,
            input_payload=proposal.input_payload,
            result_payload=proposal.result_payload,
        )
        repo.session.commit()
        repo.session.refresh(new_scenario)
        log.info(
            f"📄 Proposta salva: '{proposal.client_name}' | ID: {new_scenario.id} | Usuário: {current_user.email}"
        )
        return new_scenario
    except Exception as e:
        repo.session.rollback()
        log.error(f"❌ Erro ao salvar proposta para {current_user.email}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[ProposalResponse])
def list_proposals(repo: RepoDep, current_user: CurrentUserDep):
    proposals = repo.list_scenarios_by_user(current_user.id)
    log.debug(
        f"📋 Usuário {current_user.email} listou seu histórico ({len(proposals)} itens)"
    )
    return proposals


@router.get("/{proposal_id}", response_model=ProposalResponse)
def get_proposal(proposal_id: str, repo: RepoDep, current_user: CurrentUserDep):
    scenario = repo.get_scenario_by_id(
        user_id=current_user.id, scenario_id=uuid.UUID(proposal_id)
    )
    if not scenario:
        log.warning(
            f"🕵️ Tentativa de acesso a proposta inexistente ou IDOR: {proposal_id} por {current_user.email}"
        )
        raise HTTPException(status_code=404, detail="Proposta não encontrada")

    log.debug(f"🔍 Proposta visualizada: {proposal_id} ({scenario.client_name})")
    return scenario


@router.put("/{proposal_id}", response_model=ProposalResponse)
def update_proposal(
    proposal_id: str,
    proposal: ProposalCreate,
    repo: RepoDep,
    current_user: CurrentUserDep,
):
    try:
        updated = repo.update_scenario(
            user_id=current_user.id,
            scenario_id=uuid.UUID(proposal_id),
            client_name=proposal.client_name,
            input_payload=proposal.input_payload,
            result_payload=proposal.result_payload,
        )
        if not updated:
            log.warning(
                f"⚠️ Tentativa de atualização de proposta inexistente ou IDOR: {proposal_id} por {current_user.email}"
            )
            raise HTTPException(status_code=404, detail="Proposta não encontrada")

        repo.session.commit()
        repo.session.refresh(updated)
        log.info(
            f"📝 Proposta atualizada: '{proposal.client_name}' | ID: {proposal_id} | Usuário: {current_user.email}"
        )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        repo.session.rollback()
        log.error(f"❌ Erro ao atualizar proposta {proposal_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(proposal_id: str, repo: RepoDep, current_user: CurrentUserDep):
    success = repo.delete_scenario(
        user_id=current_user.id, scenario_id=uuid.UUID(proposal_id)
    )
    if not success:
        log.warning(
            f"⚠️ Falha na exclusão (não encontrado ou IDOR): {proposal_id} por {current_user.email}"
        )
        raise HTTPException(
            status_code=404, detail="Proposta não encontrada ou acesso negado"
        )

    repo.session.commit()
    log.info(f"🗑️ Proposta excluída: {proposal_id} por {current_user.email}")
    return None


@router.get("/{proposal_id}/pdf-url")
def get_pdf_url(proposal_id: str, service: ServiceDep, current_user: CurrentUserDep):
    """Retorna URL para download do PDF (gerado no frontend)."""
    url = service.get_pdf_download_url(uuid.UUID(proposal_id), current_user.id)
    return {"url": url}


@router.post("/{proposal_id}/send-email")
def send_proposal_email(
    proposal_id: str,
    service: ServiceDep,
    current_user: CurrentUserDep,
    payload: dict = Body(...),
):
    """Envia resumo do orçamento por e-mail."""
    recipient_email = payload.get("email", "")
    client_name = payload.get("client_name", "")
    message = payload.get("message", "")

    if not recipient_email:
        raise HTTPException(
            status_code=400, detail="E-mail do destinatário é obrigatório"
        )

    try:
        service.send_email(
            proposal_id=uuid.UUID(proposal_id),
            user_id=current_user.id,
            recipient_email=recipient_email,
            client_name=client_name,
            message=message,
        )
        log.info(
            f"📧 Orçamento enviado por e-mail para {recipient_email} por {current_user.email}"
        )
        return {"message": "E-mail enviado com sucesso."}
    except RuntimeError as e:
        log.error(f"❌ Erro ao enviar e-mail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{proposal_id}/whatsapp")
def get_whatsapp_link(
    proposal_id: str,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Gera link de compartilhamento via WhatsApp."""
    result = service.get_whatsapp_message(uuid.UUID(proposal_id), current_user.id)
    return result
