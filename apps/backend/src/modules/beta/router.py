"""
Beta Module - Router

Captação de Betas pela página inicial. O cadastro é público (com limite por
IP); a lista de inscrições é só para administradores.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.rate_limit import BETA_SIGNUP_LIMIT, limiter
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import require_admin

from .repository import BetaSignupRepository
from .schemas import BetaSignupAccepted, BetaSignupCreate, BetaSignupResponse
from .service import BetaSignupService

router = APIRouter(prefix="/beta", tags=["beta"])

SessionDep = Annotated[Session, Depends(get_db_session)]
AdminDep = Annotated[UserResponse, Depends(require_admin)]


@router.post(
    "/inscricoes",
    response_model=BetaSignupAccepted,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(BETA_SIGNUP_LIMIT)
def create_signup(request: Request, signup_in: BetaSignupCreate, db: SessionDep):
    """Inscrição pública de Beta. A resposta é sempre a mesma (não revela e-mails)."""
    BetaSignupService(BetaSignupRepository(db)).register(signup_in)
    return BetaSignupAccepted()


@router.get("/inscricoes", response_model=list[BetaSignupResponse])
def list_signups(_admin: AdminDep, db: SessionDep):
    """Inscrições mais recentes primeiro (somente admin)."""
    return BetaSignupRepository(db).list_recent()
