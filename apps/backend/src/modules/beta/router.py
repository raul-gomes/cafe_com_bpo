"""
Beta Module - Router

Beta tester acquisition on the landing page. The signup is public (rate
limited by IP); the signup list is admin only and feeds the "Inscrições Beta"
admin page.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.rate_limit import BETA_SIGNUP_LIMIT, limiter
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import require_admin

from .models import BetaSignup
from .repository import BetaSignupRepository
from .schemas import BetaSignupAccepted, BetaSignupCreate, BetaSignupResponse
from .service import BetaSignupService

router = APIRouter(prefix="/beta", tags=["beta"])

SessionDep = Annotated[Session, Depends(get_db_session)]
AdminDep = Annotated[UserResponse, Depends(require_admin)]


@router.post(
    "/signups",
    response_model=BetaSignupAccepted,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit(BETA_SIGNUP_LIMIT)
def create_signup(
    request: Request, signup_in: BetaSignupCreate, db: SessionDep
) -> BetaSignupAccepted:
    """Public Beta signup. The answer is always the same (reveals no e-mail).

    Args:
        request: Incoming request (used by the rate limiter).
        signup_in: Validated signup payload.
        db: Database session.

    Returns:
        The neutral acknowledgement.
    """
    BetaSignupService(BetaSignupRepository(db)).register(signup_in)
    return BetaSignupAccepted()


@router.get("/signups", response_model=list[BetaSignupResponse])
def list_signups(_admin: AdminDep, db: SessionDep) -> list[BetaSignup]:
    """Most recent signups first (admin only).

    Args:
        _admin: Authenticated administrator.
        db: Database session.

    Returns:
        The signups shown on the admin page.
    """
    return BetaSignupRepository(db).list_recent()
