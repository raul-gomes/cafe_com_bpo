"""Response schemas of the subscription area."""

from datetime import datetime

from pydantic import BaseModel


class PlanSummaryResponse(BaseModel):
    """Plan fields the payments screen renders in its call to action."""

    code: str
    name: str
    price: str
    cycle: str


class AccessResponse(BaseModel):
    """Answer of `GET /access`.

    The module list travels with the answer so the frontend never keeps its own
    copy of the gate map (§4): two copies drift, and the symptom is a user
    locked out of a module they paid for, or a free user editing a proposal.

    Only what a screen renders is here. The subscription row, the Asaas ids and
    the timestamps of the row itself stay internal.
    """

    access: str
    read_only_modules: list[str]
    writable_modules: list[str]
    expires_at: datetime | None = None
    grace_until: datetime | None = None
    shows_dunning_banner: bool = False
    subscription_status: str | None = None
    plan: PlanSummaryResponse | None = None
    is_admin: bool = False
