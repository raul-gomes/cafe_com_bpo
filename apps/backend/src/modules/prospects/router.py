from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.clients.repository import ClientRepository
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


def get_client_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> ClientRepository:
    return ClientRepository(session)


ProspectRepoDep = Annotated[ProspectRepository, Depends(get_prospect_repository)]
ClientRepoDep = Annotated[ClientRepository, Depends(get_client_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


def _to_response(prospect) -> ProspectResponse:
    return ProspectResponse(
        **{k: getattr(prospect, k) for k in prospect.__dict__ if not k.startswith("_")}
    )


@router.get("/", response_model=list[ProspectResponse])
def get_prospects(
    repo: ProspectRepoDep,
    current_user: CurrentUserDep,
):
    """Retorna os prospectos ativos e não convertidos do usuário atual."""
    return [_to_response(p) for p in repo.get_by_user(current_user.id)]


@router.post("/", response_model=ProspectResponse, status_code=status.HTTP_201_CREATED)
def create_prospect(
    prospect_in: ProspectCreate,
    repo: ProspectRepoDep,
    current_user: CurrentUserDep,
):
    new_prospect = repo.create(prospect_in, current_user.id)
    log.info(f"🚀 Prospecto criado: {prospect_in.name} por {current_user.email}")
    return _to_response(new_prospect)


@router.put("/{prospect_id}", response_model=ProspectResponse)
def update_prospect(
    prospect_id: UUID,
    prospect_in: ProspectUpdate,
    repo: ProspectRepoDep,
    current_user: CurrentUserDep,
):
    prospect = repo.get_by_id(prospect_id, current_user.id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado")

    updated = repo.update(prospect, prospect_in)
    return _to_response(updated)


@router.delete("/{prospect_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prospect(
    prospect_id: UUID,
    repo: ProspectRepoDep,
    current_user: CurrentUserDep,
):
    """Arquiva um prospecto (soft delete)."""
    prospect = repo.get_by_id(prospect_id, current_user.id)
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto não encontrado")

    repo.delete(prospect)


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
    return _to_response(updated)


@router.post("/{prospect_id}/unreprove", response_model=ProspectResponse)
def unreprove_prospect(
    prospect_id: UUID,
    repo: ProspectRepoDep,
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
    return _to_response(updated)
