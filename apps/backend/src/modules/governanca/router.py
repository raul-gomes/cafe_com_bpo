from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .repository import GovernancaRepository
from .schemas import GovernancaResponse
from .service import GovernancaService

router = APIRouter(prefix="/governanca", tags=["governanca"])


def get_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> GovernancaRepository:
    return GovernancaRepository(session)


GovernancaRepoDep = Annotated[GovernancaRepository, Depends(get_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


def _months_from_deals(deals: list) -> list[str]:
    months: set[str] = set()
    for deal in deals:
        months.add(deal.reference_date.strftime("%Y-%m"))
    return sorted(months, reverse=True)


@router.get("/deals", response_model=GovernancaResponse)
def list_deals(repo: GovernancaRepoDep, current_user: CurrentUserDep):
    """Visão macro da captação: todos os negócios do usuário com status
    (conquistado / em_negociacao / perdido) e timeline, para a Governança."""
    deals = GovernancaService(repo).get_deals(current_user.id)
    months = _months_from_deals(deals)
    log.debug(f"📊 Governança: {len(deals)} negócios para {current_user.email}")
    return GovernancaResponse(months=months, deals=deals)
