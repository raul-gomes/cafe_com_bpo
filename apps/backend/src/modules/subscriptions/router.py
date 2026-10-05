"""HTTP entry points of the subscription area.

Two routers live here: `/access` (what the caller may do, asked once per session
by the frontend) and `/subscriptions` (the plan itself). They are separate paths
because the frontend loads the access answer for every authenticated screen,
while the subscription screen is one of them.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.entitlements import Access, resolve_access
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.subscriptions.schemas import AccessResponse, PlanSummaryResponse

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
access_router = APIRouter(prefix="/access", tags=["access"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
SessionDep = Annotated[Session, Depends(get_db_session)]


@access_router.get("", response_model=AccessResponse)
def get_access(session: SessionDep, current_user: CurrentUserDep) -> AccessResponse:
    """Resolves what the authenticated user may do.

    Args:
        session: Database session.
        current_user: Authenticated user.

    Returns:
        The resolved access, with the module list the gate uses.
    """
    return _to_response(
        resolve_access(session, current_user, now=datetime.now(UTC)),
        is_admin=current_user.role == "admin",
    )


def _to_response(access: Access, *, is_admin: bool) -> AccessResponse:
    """Adapts the resolved access to the response schema.

    Args:
        access: Resolved access.
        is_admin: Whether the user is an admin, repeated so the UI can hide
            admin-only affordances without guessing from the state.

    Returns:
        The response body.
    """
    return AccessResponse(
        access=str(access.state),
        read_only_modules=list(access.read_only_modules),
        writable_modules=list(access.writable_modules),
        expires_at=access.expires_at,
        grace_until=access.grace_until,
        shows_dunning_banner=access.shows_dunning_banner,
        subscription_status=access.subscription_status,
        plan=PlanSummaryResponse(
            code=access.plan.code,
            name=access.plan.name,
            price=access.plan.price,
            cycle=access.plan.cycle,
        )
        if access.plan
        else None,
        is_admin=is_admin,
    )
