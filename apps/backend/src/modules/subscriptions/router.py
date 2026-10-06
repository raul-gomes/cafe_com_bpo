"""HTTP entry points of the subscription area.

Two routers live here: `/access` (what the caller may do, asked once per session
by the frontend) and `/subscriptions` (the plan itself). They are separate paths
because the frontend loads the access answer for every authenticated screen,
while the subscription screen is one of them.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.asaas_client import AsaasClient
from src.core.database import get_db_session
from src.core.entitlements import Access, resolve_access
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user, require_admin
from src.modules.subscriptions.repository import BillingProfileRepository
from src.modules.subscriptions.schemas import (
    AccessResponse,
    BillingProfileResponse,
    CancelResponse,
    CheckoutCreate,
    CheckoutResponse,
    PlanCreate,
    PlanResponse,
    PlanSummaryResponse,
    PlanUpdate,
    PriceSyncResponse,
)
from src.modules.subscriptions.service import (
    CheckoutService,
    PlanService,
    PricePropagationService,
    SubscriptionCancelService,
)

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
        shows_beta_banner=access.shows_beta_banner,
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
async def update_plan(
    plan_id: UUID,
    data: PlanUpdate,
    session: SessionDep,
    current_user: AdminDep,
) -> PlanResponse:
    """Edits a plan's name, price, description or active flag.

    A price change is pushed to Asaas as part of the same call (§17.1): the
    provider generates the next charge ~40 days ahead, so the new value must
    reach it now, and `price_sync_status` records whether it agreed. Rows the
    provider refuses keep the edit successful — the failure is retried by the
    resync button or by the daily reconciliation.

    Args:
        plan_id: Plan to edit.
        data: Validated body; only the fields sent are written.
        session: Database session.
        current_user: Authenticated admin; `require_admin` rejects the others.

    Returns:
        The updated plan.
    """
    service = PlanService(session)
    updated = service.update_plan(current_user, plan_id, data)
    if data.price is not None:
        # Every price edit ends with a push. Rows the provider already knows
        # about at the current price are counted as skipped inside the service,
        # so an unchanged price costs no provider traffic while a name-only
        # edit never reaches here.
        await PricePropagationService(session, AsaasClient()).propagate_for_plan_id(
            plan_id, now=datetime.now(UTC)
        )
    return updated


@plans_router.post("/{plan_id}/sync-prices", response_model=PriceSyncResponse)
async def resync_plan_prices(
    plan_id: UUID,
    session: SessionDep,
    current_user: AdminDep,
) -> PriceSyncResponse:
    """Resyncs the plan's price: re-pushes every row that still owes it.

    The resync button of the Config tab: an admin asks Asaas again for the rows
    that sit in `failed` (or whose prices silently drifted), and the answer is
    the counts the screen renders.

    Args:
        plan_id: Plan whose live rows are pushed.
        session: Database session.
        current_user: Authenticated admin; `require_admin` rejects the others.

    Returns:
        The counts of the push: sync, refused and skipped.
    """
    result = await PricePropagationService(
        session, AsaasClient()
    ).propagate_for_plan_id(plan_id, now=datetime.now(UTC))
    return PriceSyncResponse(
        synced=result.synced, failed=result.failed, skipped=result.skipped
    )


@router.post(
    "/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED
)
async def open_checkout(
    data: CheckoutCreate,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> CheckoutResponse:
    """Opens the hosted checkout where the buyer subscribes a plan.

    The response carries the link to redirect to; the card is typed on Asaas's
    page, so nothing about it passes through here (§17.2). Creating the session
    is not paying: the row starts `incomplete` and the webhook of Fase 5 promotes
    it when `CHECKOUT_PAID` arrives.

    Args:
        data: Body with the `plan_id` and nothing else; the price comes from
            `plans.price` (§17.1).
        session: Database session.
        current_user: Authenticated user buying the plan.

    Returns:
        The link to redirect to, with the plan and its price.
    """
    return await CheckoutService(session, AsaasClient()).open_checkout(
        current_user, data
    )


@router.post("/cancel", response_model=CancelResponse)
async def cancel_subscription(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> CancelResponse:
    """Cancels the caller's subscription and answers the confirmation screen (§17.5).

    No id in the path and no body: the row is looked up from the session's
    user, so nobody can cancel somebody else's subscription. Who cancels
    keeps the month already paid — the answer says until when — and an
    unpaid abandoned checkout is discarded, not cancelled.

    Args:
        session: Database session.
        current_user: Authenticated user cancelling their own subscription.

    Returns:
        The paid-through instant, or `null` when a checkout was discarded.

    Raises:
        HTTPException: 404 when there is nothing to cancel; 502 when the
            provider refuses or cannot be asked.
    """
    return await SubscriptionCancelService(session, AsaasClient()).cancel(
        current_user, now=datetime.now(UTC)
    )


@router.get("/billing", response_model=BillingProfileResponse)
def get_billing_profile(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> BillingProfileResponse:
    """Returns the caller's saved billing data, for the form to prefill (§17.8).

    404 rather than an empty object when nothing is saved: the form knows what to
    do with a 404 (ask for everything) and what to do with empty fields (ask for
    what is missing), which are different screens.

    Scoped to `current_user` in the query itself. A document and an address are
    personal data (§17.7): the ownership check belongs where the row is read, not
    only in the router.

    Args:
        session: Database session.
        current_user: Authenticated user.

    Returns:
        The saved profile.

    Raises:
        HTTPException: 404 when the user never saved billing data.
    """
    profile = BillingProfileRepository(session).get_for_user(current_user.id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Você ainda não informou seus dados de cobrança.",
        )
    return BillingProfileResponse(
        cpf_cnpj=profile.cpf_cnpj,
        phone=profile.phone,
        address=profile.address,
        address_number=profile.address_number,
        complement=profile.complement,
        city=profile.city,
        state=profile.state,
        postal_code=profile.postal_code,
    )
