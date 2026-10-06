"""Schemas of the subscription area."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.core.asaas_client import SUBSCRIPTION_CYCLES
from src.core.validators import (
    validate_document,
    validate_phone,
    validate_postal_code,
)

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


class BillingData(BaseModel):
    """Document and address the provider needs before it will sell (§17.8).

    Every field is normalized on the way in, because the two rules that break
    silently are the ones about shape:

    - `phone` reaches Asaas as digits only. A masked number is refused with
      *"o campo phoneNumber deve ser informado"*, a message that blames a missing
      field for a formatting problem — the user sees a form error for something
      they did right.
    - `cpf_cnpj` is checked digit by digit. The permissive rule of the
      registration form is wrong here: a bad document would only surface at
      payment confirmation, with the user looking at a screen saying it worked.
    - `state` is uppercased so "sp" and "SP" are the same profile.
    - `city` is a name. Asaas accepts the name and nobody should type an IBGE code.

    `extra="forbid"` for the same reason as `CheckoutCreate`: a field we silently
    drop is a field the form believes was saved.

    None of this is card data, so PCI DSS SAQ A is unaffected.
    """

    model_config = ConfigDict(extra="forbid")

    cpf_cnpj: str = Field(min_length=11, max_length=18)
    phone: str = Field(min_length=10, max_length=20)
    address: str = Field(min_length=3, max_length=200)
    address_number: str = Field(min_length=1, max_length=20)
    complement: str | None = Field(default=None, max_length=120)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    postal_code: str = Field(min_length=8, max_length=9)

    @field_validator("cpf_cnpj")
    @classmethod
    def _normalize_document(cls, value: str) -> str:
        """Validates the document and returns it without punctuation.

        Args:
            value: The document as typed.

        Returns:
            The digits only.

        Raises:
            ValueError: When the check digit does not add up.
        """
        return validate_document(value) or ""

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        """Strips punctuation and the country code.

        Args:
            value: The phone as typed.

        Returns:
            Ten or eleven digits.

        Raises:
            ValueError: When the number has no plausible Brazilian length.
        """
        return validate_phone(value) or ""

    @field_validator("state")
    @classmethod
    def _uppercase_state(cls, value: str) -> str:
        """Uppercases the state code.

        Args:
            value: The state as typed.

        Returns:
            The two-letter code in upper case.
        """
        return value.upper()

    @field_validator("postal_code")
    @classmethod
    def _normalize_postal_code(cls, value: str) -> str:
        """Reduces the postal code to the eight digits the column stores.

        Args:
            value: The postal code as typed.

        Returns:
            Eight digits.

        Raises:
            ValueError: When the code does not have eight digits.
        """
        return validate_postal_code(value) or ""

    @field_validator("address", "address_number", "city")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        """Removes the surrounding spaces an autofill or a copy leaves behind.

        Args:
            value: What the user typed.

        Returns:
            The value trimmed.
        """
        return value.strip() if isinstance(value, str) else value


class BillingProfileResponse(BaseModel):
    """Saved billing data, as the subscription form reads it back.

    Purpose-built and not the ORM: the form needs to prefill eight fields and
    nothing else (§6). `complement` is nullable because it is optional in the
    provider too.
    """

    cpf_cnpj: str
    phone: str
    address: str
    address_number: str
    complement: str | None
    city: str
    state: str
    postal_code: str


class CheckoutCreate(BaseModel):
    """Body of `POST /subscriptions/checkout`.

    One field, and `extra="forbid"` is the rule rather than a nicety: §17.1 makes
    `plans.price` the only source of the price, so a `price` in this body is
    refused with a 422 instead of being ignored. A client that sends one believes
    it is paying that amount, and silently charging `plans.price` is how a person
    ends up upset in a support ticket.

    The subscription id is minted here and never accepted from the client: it is
    what `externalReference` carries and what the webhook matches on, so a
    client-supplied id would point the confirmation at someone else's history.

    `billing` is optional here because the answer depends on the database, which
    this schema cannot see: a user who already saved their data opens the
    checkout with a plan id alone (§17.8), while a first-time subscriber must send
    it. The service decides, and refuses a checkout with neither.
    """

    model_config = ConfigDict(extra="forbid")

    plan_id: UUID
    billing: BillingData | None = None


class CheckoutResponse(BaseModel):
    """Answer of `POST /subscriptions/checkout`.

    Only what the payments screen shows: the plan being bought, the price it
    will cost, and the link that opens the Asaas page where the card is typed.
    `status` is `incomplete` — the session exists, nobody paid yet (§17.2).
    """

    link: str
    plan_name: str
    price: Decimal
    cycle: str
    status: str


class CancelResponse(BaseModel):
    """Answer of `POST /subscriptions/cancel`.

    The confirmation screen reads one thing: until when the access lasts
    (§17.5 — who cancels keeps the month already paid). `null` means there was
    never a paid period: an abandoned checkout was discarded, not cancelled.
    """

    current_period_end: datetime | None


class PriceSyncResponse(BaseModel):
    """Answer of `POST /plans/{plan_id}/sync-prices`.

    The Config tab renders the three counts of the resync button: how many
    subscriptions the provider agreed on, how many refused, and how many were
    left alone because the provider already knows the current price.
    """

    synced: int
    failed: int
    skipped: int
