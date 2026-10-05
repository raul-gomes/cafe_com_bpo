"""HTTP entry points of the subscription area.

Two routers live here: `/access` (what the caller may do, asked once per session
by the frontend) and `/subscriptions` (the plan itself). They are separate paths
because the frontend loads the access answer for every authenticated screen,
while the subscription screen is one of them.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.entitlements import Access, resolve_access
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user, require_admin
from src.modules.subscriptions.schemas import (
    AccessResponse,
    PlanCreate,
    PlanResponse,
    PlanSummaryResponse,
    PlanUpdate,
)
from src.modules.subscriptions.service import PlanService

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
access_router = APIRouter(prefix="/access", tags=["access"])
plans_router = APIRouter(prefix="/plans", tags=["plans"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
AdminDep = Annotated[UserResponse, Depends(require_admin)]
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


@plans_router.get("", response_model=list[PlanResponse])
def list_plans(session: SessionDep, current_user: CurrentUserDep) -> list[PlanResponse]:
    """Lists the plan catalog.

    Any authenticated caller may read it, because the checkout has to know what
    is for sale; the service hides the deactivated plans from everyone but the
    admin, so the filter never depends on a flag the browser sends.

    Args:
        session: Database session.
        current_user: Authenticated user.

    Returns:
        The plans visible to the caller.
    """
    return PlanService(session).list_plans(current_user)


@plans_router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    data: PlanCreate,
    session: SessionDep,
    current_user: AdminDep,
) -> PlanResponse:
    """Creates a plan — the write that defines a price (§17.1).

    Args:
        data: Validated body.
        session: Database session.
        current_user: Authenticated admin; `require_admin` rejects the others.

    Returns:
        The created plan.
    """
    return PlanService(session).create_plan(current_user, data)


@plans_router.patch("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: UUID,
    data: PlanUpdate,
    session: SessionDep,
    current_user: AdminDep,
) -> PlanResponse:
    """Edits a plan's name, price, description or active flag.

    Args:
        plan_id: Plan to edit.
        data: Validated body; only the fields sent are written.
        session: Database session.
        current_user: Authenticated admin; `require_admin` rejects the others.

    Returns:
        The updated plan.
    """
    return PlanService(session).update_plan(current_user, plan_id, data)
