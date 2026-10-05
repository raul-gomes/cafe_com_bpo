"""Response schemas of the subscription area."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.core.asaas_client import SUBSCRIPTION_CYCLES

CODE_PATTERN = r"^[a-z0-9][a-z0-9_-]*$"


class PlanSummaryResponse(BaseModel):
    """Plan fields the payments screen renders in its call to action."""

    code: str
    name: str
    price: str
    cycle: str


class PlanCreate(BaseModel):
    """Body of `POST /plans`.

    `extra="forbid"` because this is the write that defines the price: a field
    the server did not ask for (an `id`, a `subscriber_count`) is a bug or an
    attempt, never something to be silently ignored.
    """

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        min_length=2,
        max_length=50,
        pattern=CODE_PATTERN,
        description="Business key, lowercase, immutable after creation.",
    )
    name: str = Field(min_length=2, max_length=150)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    cycle: str
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("cycle")
    @classmethod
    def cycle_must_be_billable(cls, value: str) -> str:
        """Accepts only the cycles the billing client knows.

        Args:
            value: Cycle sent by the client.

        Returns:
            The validated cycle.

        Raises:
            ValueError: When Asaas does not bill that cycle.
        """
        if value not in SUBSCRIPTION_CYCLES:
            raise ValueError(
                f"ciclo inválido, use um de: {', '.join(sorted(SUBSCRIPTION_CYCLES))}"
            )
        return value


class PlanUpdate(BaseModel):
    """Body of `PATCH /plans/{plan_id}`.

    Only the commercial attributes are editable. `code` and `cycle` are absent on
    purpose: the code is what `subscriptions.plan_id` points at, so renaming it
    would repoint paid history, and changing the cycle of a plan with subscribers
    would change what they were sold.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=150)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None


class PlanResponse(BaseModel):
    """A row of the plan catalog as the Config screen renders it.

    `subscriber_count` travels because the admin needs to know whether a plan can
    be archived before touching it. The timestamps do not travel: nothing on the
    screen shows them (§6).
    """

    id: str
    code: str
    name: str
    price: str
    cycle: str
    is_active: bool
    description: str | None = None
    subscriber_count: int


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
