"""Business rules of the plan catalog, of starting a subscription and of the
webhook state machine that keeps one alive.

Three services live here. `PlanService` guards the catalog, the only writer of
`plans`. `CheckoutService` opens the payment journey. `SubscriptionWebhookService`
is the state machine of §17: it turns the provider's events into the local row's
status, period and grace — the row is the authority, the provider only reports.

Their rules live in the service and not in the router, because a router check is
bypassed the moment another caller appears (a job, a script):

- **§17.1 — the price is edited by an admin**, and it is also **read from the
  database and never from the request**: `POST /subscriptions/checkout` takes a
  `plan_id` and nothing else.
- **The code is frozen.** It is the business key `subscriptions.plan_id` points
  at; renaming it would repoint what people were sold.
- **§17.2 — opening a checkout is not paying.** The local row is created
  `incomplete` and only the webhook promotes it.
- **§17.6 — a beta pays after the free year**, so the first charge is dated the
  day after `beta_access.expires_at`.
- **§17.4/§17.5 — the webhook moves status, never access**: `past_due` opens the
  three-day window, `canceled` keeps the paid period, and every transition is
  guarded so a reordered event cannot erase money that arrived.
"""

import logging
from calendar import monthrange
from collections.abc import Awaitable, Callable
from datetime import UTC, date, datetime, time, timedelta
from typing import NamedTuple, NoReturn
from urllib.parse import urlsplit
from uuid import UUID, uuid4

import httpx
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.core.asaas_client import AsaasClient, parse_asaas_date
from src.core.config import get_settings
from src.core.database import SessionLocal
from src.core.deadline import BUSINESS_TZ, business_date
from src.core.entitlements import as_utc, running_beta
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.subscriptions.models import (
    PRICE_SYNC_FAILED,
    PRICE_SYNC_PENDING,
    PRICE_SYNC_SYNCED,
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_INCOMPLETE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BillingProfile,
    Plan,
    Subscription,
)
from src.modules.subscriptions.repository import (
    BillingProfileRepository,
    PlanRepository,
    SubscriptionRepository,
)
from src.modules.subscriptions.schemas import (
    CancelResponse,
    CheckoutCreate,
    CheckoutResponse,
    PlanCreate,
    PlanResponse,
    PlanUpdate,
)

logger = logging.getLogger(__name__)

ROLE_ADMIN = "admin"

# A session left open expires by itself, so a buyer who walks away does not hold
# a live checkout forever. Asaas accepts 10..1440 minutes.
CHECKOUT_MINUTES_TO_EXPIRE = 60


class PriceSyncResult(NamedTuple):
    """The outcome of pushing a plan's price to the provider.

    A named tuple on purpose: the resync endpoint renders it as a `dict`
    (`asdict` unscramble) and the router/flow tests compare it to a plain
    `(synced, failed, skipped)` triple.

    Attributes:
        synced: Rows the provider agreed on.
        failed: Rows the provider refused (kept `failed` for a retry).
        skipped: Live rows already `synced` at the current price.
    """

    synced: int
    failed: int
    skipped: int


# Route the payer lands on after finishing (or abandoning) the hosted page.
CHECKOUT_RESULT_PATHS = {
    "success": "/painel/pagamentos?checkout=paid",
    "cancel": "/painel/pagamentos?checkout=canceled",
    "expired": "/painel/pagamentos?checkout=expired",
}


def add_billing_month(day: date) -> date:
    """The date one monthly cycle after `day`, clamped to the short month.

    A charge on Jan 31 renews on Feb 28 — `monthrange` clamps instead of
    rolling into March, which would silently stretch the period. The platform
    sells only the `MONTHLY` cycle (`SUBSCRIPTION_CYCLE_MONTHLY`); a new cycle
    must bring its own step rather than borrowing this one.

    Args:
        day: Start of the billing cycle.

    Returns:
        The same day next month, or the last day of that month.
    """
    year = day.year + (day.month // 12)
    month = day.month % 12 + 1
    return date(year, month, min(day.day, monthrange(year, month)[1]))


def _business_start(day: date) -> datetime:
    """Start of a business day (midnight in São Paulo) as a UTC instant.

    A due date is a calendar day, so a period boundary belongs to the day the
    *user* lives in: midnight America/Sao_Paulo is 03:00 UTC, and using UTC
    midnight would end every period three hours before the day it names.

    Args:
        day: The calendar day.

    Returns:
        The instant the day begins, in UTC.
    """
    return datetime.combine(day, time.min, tzinfo=BUSINESS_TZ).astimezone(UTC)


def _next_charge_boundary(due: date | None, now: datetime) -> datetime:
    """Start of the business day the *next* charge falls on after a checkout.

    Three cases, because `CHECKOUT_PAID` means the charge for `due` already
    happened when it is due today or in the past, and has *not* happened yet
    when a beta's first charge is dated months ahead:

    - due after today → the period runs to that future due date itself;
    - due today or already past → one full cycle later;
    - due unknown (neither payload nor provider said it) → one cycle from
      today, logged — guessing silently is how a period ends on the wrong day.

    Args:
        due: First charge date carried by the event/provider, if readable.
        now: The frozen clock of the dispatch.

    Returns:
        The instant the next charge's day begins, in UTC.
    """
    today = business_date(now)
    if due is None:
        logger.warning(
            "[subscriptions] vencimento ausente no CHECKOUT_PAID: "
            "ciclo estimado a partir de %s",
            today,
        )
        return _business_start(add_billing_month(today))
    if due > today:
        return _business_start(due)
    return _business_start(add_billing_month(due))


class PlanService:
    """Reads and writes the plan catalog on behalf of an authenticated actor.

    Args:
        session: Database session.
    """

    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = PlanRepository(session)

    def list_plans(self, actor: UserResponse) -> list[PlanResponse]:
        """Lists what the actor is allowed to see in the catalog.

        A deactivated plan is out of the catalog for everyone but the admin: the
        checkout reads this same answer, so an archived plan must never be
        offered to somebody who could subscribe to it.

        Args:
            actor: Authenticated user.

        Returns:
            The plans visible to the actor.
        """
        is_admin = actor.role == ROLE_ADMIN
        return [
            self._to_response(plan)
            for plan in self.repo.list_plans(active_only=not is_admin)
        ]

    def create_plan(self, actor: UserResponse, data: PlanCreate) -> PlanResponse:
        """Creates a plan.

        Args:
            actor: Authenticated user; only an admin may write.
            data: Validated body.

        Returns:
            The created plan.

        Raises:
            HTTPException: 403 when the actor is not an admin, 409 when the code
                is already taken.
        """
        self._require_admin(actor)
        if self.repo.get_by_code(data.code) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um plano com este código",
            )

        plan = Plan(
            code=data.code,
            name=data.name,
            price=data.price,
            cycle=data.cycle,
            description=data.description,
            is_active=data.is_active,
        )
        try:
            self.repo.add(plan)
            self.session.commit()
        except IntegrityError:
            # Two admins saving the same code at once: the unique index is the
            # real arbiter, the check above is only the friendly error.
            self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um plano com este código",
            ) from None

        self.session.refresh(plan)
        return self._to_response(plan)

    def update_plan(
        self, actor: UserResponse, plan_id: UUID, data: PlanUpdate
    ) -> PlanResponse:
        """Edits the commercial attributes of a plan.

        Args:
            actor: Authenticated user; only an admin may write.
            plan_id: Plan to edit.
            data: Validated body; only the fields sent are written.

        Returns:
            The updated plan.

        Raises:
            HTTPException: 403 when the actor is not an admin, 404 when the plan
                does not exist.
        """
        self._require_admin(actor)
        plan = self.repo.get_by_id(plan_id)
        if plan is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Plano não encontrado"
            )
        # Decision of the product owner (2026-10-06): a plan that already has
        # live subscribers cannot be zeroed. Propagating `value = 0` is refused
        # by the provider, so the row would sit in `failed` forever and the
        # subscription would silently stop being billable — refused here, before
        # a single provider call. A plan nobody subscribes to is free to be
        # zeroed: the checkout guard (`open_checkout`) keeps it from ever being
        # bought.
        if (
            data.price is not None
            and data.price <= 0
            and self.repo.count_open_subscribers(plan.id) > 0
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Não é possível zerar o preço de um plano com assinantes ativos.",
            )

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(plan, field, value)
        self.session.commit()
        self.session.refresh(plan)
        return self._to_response(plan)

    @staticmethod
    def _require_admin(actor: UserResponse) -> None:
        """Enforces §17.1: only an admin edits the catalog.

        Args:
            actor: Authenticated user.

        Raises:
            HTTPException: 403 when the actor is not an admin.
        """
        if actor.role != ROLE_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso restrito a administradores",
            )

    def _to_response(self, plan: Plan) -> PlanResponse:
        """Adapts a `Plan` row to the catalog contract.

        The price is a string, the same way `GET /access` renders it, so the two
        screens can never disagree about how much the plan costs.

        Args:
            plan: Plan row.

        Returns:
            The response body.
        """
        return PlanResponse(
            id=str(plan.id),
            code=plan.code,
            name=plan.name,
            price=str(plan.price),
            cycle=plan.cycle,
            is_active=plan.is_active,
            description=plan.description,
            subscriber_count=self.repo.count_subscribers(plan.id),
        )


class CheckoutService:
    """Opens a hosted checkout and records the intent to subscribe.

    §17.2 makes the card a thing Asaas hosts: this service never sees a number,
    a CVV or a token, which is what keeps the platform in PCI DSS SAQ A. What it
    does is decide *which* plan, *when* the first charge is due and *which*
    Asaas customer pays, then hand the buyer a link.

    Args:
        session: Database session.
        client: Provider client, injected so the journey is testable offline.
    """

    def __init__(self, session: Session, client: AsaasClient) -> None:
        """Binds the service to a session and to the provider.

        Args:
            session: Database session.
            client: Asaas client.
        """
        self.session = session
        self.client = client
        self.plans = PlanRepository(session)
        self.subscriptions = SubscriptionRepository(session)
        self.billing = BillingProfileRepository(session)

    async def open_checkout(
        self,
        actor: UserResponse,
        data: CheckoutCreate,
        *,
        now: datetime | None = None,
    ) -> CheckoutResponse:
        """Opens the payment journey for a plan.

        The order matters. The local row is written **first** because its id
        travels to Asaas as `externalReference` and is the only thing the webhook
        of Fase 5 can match the confirmation on; the row is `incomplete` because
        a session is not a payment.

        Args:
            actor: Authenticated user buying the plan.
            data: Body of the request, carrying the `plan_id` and nothing else.
            now: Instant used to date the first charge; defaults to the current
                UTC time. Injected by the tests, since a charge dated "today"
                would otherwise make them depend on the wall clock.

        Returns:
            The link the buyer is redirected to, with the plan and its price.

        Raises:
            HTTPException: 404 when the plan does not exist, 422 when it is
                deactivated, 409 when the person already has a live
                subscription — except a `past_due` one on the same plan, which
                is the P-22 regularize (the payment the dunning window exists
                for).
        """
        moment = now or datetime.now(UTC)

        plan = self.plans.get_by_id(data.plan_id)
        if plan is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Plano não encontrado.",
            )
        if not plan.is_active:
            # Deactivation is the whole lifecycle of a plan (§17.1): it stops
            # being sold without touching who already bought it.
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Este plano não está disponível para novos assinantes.",
            )
        if plan.price is None or plan.price <= 0:
            # §17.1: the price comes from `plans.price`, so a plan priced zero
            # (or without a price) has nothing to charge and must not reach the
            # provider — refusing here, before billing data is consulted, stops
            # a buyer with no saved data from seeing a 422 about a billing
            # problem this plan does not have.
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este plano não tem um preço válido no momento.",
            )
        live = self.subscriptions.get_open_for_user(actor.id)
        if live is not None and (
            live.status != SUBSCRIPTION_STATUS_PAST_DUE or live.plan_id != plan.id
        ):
            # Refused before the provider is called, so nobody ends up with a
            # live session nobody will ever confirm. The one exception is the
            # P-22 regularize (opção A, §17.4 "volta ao normal sozinho"): an
            # overdue row is exactly what the user must be able to pay, and
            # only on the plan they are overdue on — never on another.
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Você já possui uma assinatura em andamento.",
            )

        user = self.session.get(User, actor.id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado."
            )

        billing, changed = self._resolve_billing(actor.id, data)
        customer_id = await self._ensure_customer(user, actor, billing, changed)
        first_due_date = self._first_due_date(user.id, moment)

        if live is None:
            subscription = self.subscriptions.add(
                Subscription(
                    id=uuid4(),
                    user_id=user.id,
                    plan_id=plan.id,
                    # Opening a session is not paying (§17.2): Fase 5 promotes
                    # this row when `CHECKOUT_PAID` arrives.
                    status=SUBSCRIPTION_STATUS_INCOMPLETE,
                    cycle=plan.cycle,
                    price=plan.price,
                    asaas_customer_id=customer_id,
                    # The price in the session came from the row, so there is
                    # nothing left to reconcile with the provider.
                    price_sync_status=PRICE_SYNC_SYNCED,
                )
            )
        else:
            # The regularize journey re-attaches to the one row the person may
            # still have open (`past_due`, same plan): the partial unique index
            # `uq_subscriptions_open_per_user` holds exactly one non-canceled
            # row per user, so minting a second one would be refused by the
            # constraint the 409 above mirrors. The new session opens at the
            # current plan values, and the status stays `past_due` — the
            # tolerance continues until `CHECKOUT_PAID` reactivates it.
            subscription = live
            subscription.plan_id = plan.id
            subscription.price = plan.price
            subscription.cycle = plan.cycle
            subscription.price_sync_status = PRICE_SYNC_SYNCED

        checkout = await self._call_provider(
            "checkout",
            self.client.create_subscription_checkout,
            customer_id=customer_id,
            item_name=plan.name,
            item_description=plan.description or plan.name,
            value=plan.price,
            cycle=plan.cycle,
            next_due_date=first_due_date,
            success_url=self._callback_url(CHECKOUT_RESULT_PATHS["success"]),
            cancel_url=self._callback_url(CHECKOUT_RESULT_PATHS["cancel"]),
            expired_url=self._callback_url(CHECKOUT_RESULT_PATHS["expired"]),
            external_reference=str(subscription.id),
            minutes_to_expire=CHECKOUT_MINUTES_TO_EXPIRE,
        )
        checkout_id = checkout.get("id")
        link = checkout.get("link")
        if (
            not isinstance(checkout_id, str)
            or not checkout_id
            or not isinstance(link, str)
            or not link
        ):
            # Without a link the buyer has nowhere to go, and without the id
            # no webhook can ever recognise this session (`CHECKOUT_PAID`
            # carries only `checkout.id`, P-16). Nothing is committed: the
            # session stays a provider-side curiosity and the caller gets a
            # clean failure instead of a button that does nothing.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível iniciar o pagamento. Tente novamente.",
            )
        subscription.asaas_checkout_id = checkout_id

        # Committed last, once the session can be identified again. Before the
        # provider call the row only holds `incomplete` data; committing it on
        # failure would leave a row that answers 409 to every retry, with no way
        # for the user to clear it. After the call it is the record Fase 5
        # matches the payment against, by checkout id and by our reference.
        self.session.commit()

        return CheckoutResponse(
            link=link,
            plan_name=plan.name,
            price=plan.price,
            cycle=plan.cycle,
            # A fresh buyer is `incomplete`; a past_due user regularizing keeps
            # their status until `CHECKOUT_PAID` reactivates it.
            status=subscription.status,
        )

    def _resolve_billing(
        self, user_id: UUID, data: CheckoutCreate
    ) -> tuple[BillingProfile, bool]:
        """Decides which billing data the checkout carries (§17.8).

        Three cases, in this order:

        - Nothing saved and nothing sent: refused **before** the provider is
          called. Asaas would answer 400 demanding a document, a phone and an
          address, and the user would get an error from a screen they never left
          — with our message saying nothing about what to fill in.
        - Something saved: the saved profile is used, and the flag says whether
          the request changed it. An edited address is captured; an untouched one
          costs no provider call.
        - Nothing saved and something sent: the profile is created now.

        Args:
            user_id: Authenticated user.
            data: Body of the request.

        Returns:
            The profile to send to the provider, and whether it just changed.

        Raises:
            HTTPException: 422 when there is no billing data at all.
        """
        profile = self.billing.get_for_user(user_id)
        if data.billing is None:
            if profile is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Informe seus dados de cobrança para continuar.",
                )
            return profile, False

        if profile is not None and not self.billing.differs_from(profile, data.billing):
            return profile, False
        return self.billing.save(user_id, data.billing), True

    async def _ensure_customer(
        self,
        user: User,
        actor: UserResponse,
        profile: BillingProfile,
        changed: bool,
    ) -> str:
        """Returns the Asaas customer of a person, creating or completing it once.

        Creating a second customer would split the person's payment history in
        two inside the provider, which is exactly the kind of thing nobody
        notices until a refund goes to the wrong row. Completing an existing one
        is what rescues a person whose first attempt failed: the provider kept
        that id forever, and refuses the checkout until it carries the document,
        the phone and the address (§17.8).

        Args:
            user: Authenticated user row, updated in place when created.
            actor: Authenticated user as the router hands it over.
            profile: The billing data chosen by `_resolve_billing`.
            changed: Whether that data is new, which decides if the provider is
                told about it.

        Returns:
            The Asaas customer id.

        Raises:
            HTTPException: 502 when the provider answers without a customer id.
        """
        fields = {
            "name": actor.name,
            "email": actor.email,
            "cpf_cnpj": profile.cpf_cnpj,
            "phone": profile.phone,
            "address": profile.address,
            "address_number": profile.address_number,
            "complement": profile.complement,
            "city": profile.city,
            "state": profile.state,
            "postal_code": profile.postal_code,
        }

        if user.asaas_customer_id:
            # Only a real change costs a call: an unchanged address must not make
            # every attempt depend on an external service.
            if not changed:
                return user.asaas_customer_id
            customer = await self._call_provider(
                "customer",
                self.client.update_customer,
                customer_id=user.asaas_customer_id,
                **fields,
            )
        else:
            customer = await self._call_provider(
                "customer", self.client.create_customer, **fields
            )

        customer_id = customer.get("id") or user.asaas_customer_id
        if not isinstance(customer_id, str) or not customer_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível iniciar o pagamento. Tente novamente.",
            )
        user.asaas_customer_id = customer_id
        # Committed before the checkout is attempted, and that ordering is the
        # whole point: the provider keeps this customer forever, so losing the id
        # would make the next attempt create a second one and split the person's
        # payment history. A failed checkout rolls back only the row below, which
        # a retry is then free to create again.
        self.session.commit()
        return customer_id

    def _first_due_date(self, user_id: UUID, now: datetime) -> date:
        """Dates the first charge, honouring the beta's free year.

        §17.6: "quem assinar antes do fim paga só depois" — the charge falls the
        day **after** the beta ends, so nobody is billed for time they already
        had for free. An expired grant is ignored rather than pushing the date
        into the past.

        Args:
            user_id: Authenticated user.
            now: Instant the decision is made at.

        Returns:
            The day the first charge is due.
        """
        beta = running_beta(self.session, user_id=user_id, now=now)
        if beta is None:
            return now.date()

        expires_at = as_utc(beta.expires_at)
        if expires_at is None:
            return now.date()
        return (expires_at + timedelta(days=1)).date()

    async def _call_provider(
        self, what: str, operation: Callable[..., Awaitable[dict]], **fields: object
    ) -> dict:
        """Calls the payment provider and hides its vocabulary from the user.

        Asaas answers a refusal with a payload of internal terms (`invalid_object`,
        field paths, their own request id) and a status our user can do nothing
        with. Passing that through would turn a bad request into an opaque 500 and
        put provider internals in the response body. The log keeps the status so
        the failure stays diagnosable; the caller gets our own words.

        Args:
            what: Which call failed, for the log ("checkout", "customer").
            operation: Client coroutine function.
            **fields: Keyword arguments of the call.

        Returns:
            The provider payload.

        Raises:
            HTTPException: 502 with a safe message when the provider refuses.
        """
        try:
            return await operation(**fields)
        except httpx.HTTPStatusError as error:
            logger.warning(
                "%s refused by the payment provider (status %s)",
                what,
                error.response.status_code,
            )
            # Rolled back on purpose rather than left to whoever closes the
            # session: the `incomplete` row written before this call would
            # otherwise survive a refusal and answer 409 to every retry, leaving
            # the user with a subscription they cannot start and cannot clear.
            self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível iniciar o pagamento. Tente novamente.",
            ) from error

    def _callback_url(self, path: str) -> str:
        """Builds a redirect the payer lands on after the hosted page.

        Asaas refuses callback URLs hosted on `localhost` (the provider cannot
        route to it) and answers 400 `"O campo successUrl é inválido"`, which
        the user sees only as the opaque 502 returned by `_call_provider`. The
        URL is still built and sent — the warning exists so a misconfigured
        `FRONTEND_URL` shows up in the log instead of looking like a provider
        outage.

        Args:
            path: Path and query the frontend reads.

        Returns:
            The absolute URL, taken from the configured frontend.
        """
        frontend = get_settings().frontend_url.rstrip("/")
        if urlsplit(frontend).hostname == "localhost":
            logger.warning(
                "FRONTEND_URL is %s, which the Asaas provider refuses for "
                "checkout callbacks: every checkout will answer 502. "
                "Use 127.0.0.1 (or a public host) in non-production.",
                frontend,
            )
        return f"{frontend}{path}"


async def _find_provider_subscription(
    client: AsaasClient, customer_id: str | None, reference: str
) -> tuple[str | None, date | None]:
    """Finds our subscription at the provider by our own external reference.

    The `CHECKOUT_*` payload carries no subscription id, so a paid checkout
    (or a cancel whose stored id never made it) asks the provider for this
    customer's subscriptions and matches on the reference we sent when
    opening it.

    Args:
        client: Provider client to ask.
        customer_id: Asaas customer to search under, if known.
        reference: Our subscription id as sent in `externalReference`.

    Returns:
        `(provider subscription id, next due date)` — either element `None`
        when the answer carried no subscription matching the reference.

    Raises:
        httpx.HTTPError: When the provider cannot be asked — the caller
            decides whether that is best effort (`CHECKOUT_PAID`) or fatal
            (a cancel that would otherwise stop nothing over there).
    """
    if not customer_id:
        return None, None
    listing = await client.list_subscriptions(customer=customer_id, limit=100, offset=0)
    entries = listing.get("data") if isinstance(listing, dict) else None
    if not isinstance(entries, list):
        return None, None
    match = next(
        (
            entry
            for entry in entries
            if isinstance(entry, dict) and entry.get("externalReference") == reference
        ),
        None,
    )
    if match is None:
        match = next(
            (
                entry
                for entry in entries
                if isinstance(entry, dict) and entry.get("status") == "ACTIVE"
            ),
            None,
        )
    if match is None:
        match = next((entry for entry in entries if isinstance(entry, dict)), None)
    if match is None:
        return None, None
    provider_id = match.get("id")
    return (
        provider_id if isinstance(provider_id, str) else None,
        parse_asaas_date(match.get("nextDueDate")),
    )


def _price_drifted(subscription: Subscription) -> bool:
    """Tells whether a live row still owes the plan's current price.

    The rule of §17.1 is that `plans.price` is the authority: a row is done
    only when the provider was told the value it charges today. `synced` at an
    older price is drift too — the flag recorded the last good push, not a
    promise about the future.

    Args:
        subscription: A live subscription, with its plan eager-loaded.

    Returns:
        True when the provider still needs the current price.
    """
    return not (
        subscription.price_sync_status == PRICE_SYNC_SYNCED
        and subscription.price == subscription.plan.price
    )


class PricePropagationService:
    """Pushes a plan's current price to Asaas and records the result.

    The provider generates the next charge ahead of time, so a price edit must
    reach it **before** the next cycle starts (§17.1). Every push records its
    outcome in `price_sync_status` and `price_synced_at`; a row the provider
    refuses stays `failed` and is retried by the resync button or by the daily
    reconciliation. The new price itself is applied from the start: the
    subscription's `price` is the value the next charge must follow, while the
    already-paid period (`current_period_end`) is never touched — an edit
    never retroacts.

    The service is deliberately read-write close: `propagate_for_plan_id` walks
    in and commits only once, on the session it is given.

    Args:
        session: Database session.
        client: Provider client, injected so the flow is testable offline.
    """

    def __init__(self, session: Session, client: AsaasClient) -> None:
        """Binds the service to a session and to the provider.

        Args:
            session: Database session.
            client: Asaas client.
        """
        self.session = session
        self.client = client
        self.subscriptions = SubscriptionRepository(session)
        self.plans = PlanRepository(session)

    async def propagate_for_plan_id(
        self, plan_id: UUID, *, now: datetime
    ) -> PriceSyncResult:
        """Pushes the current price of a plan to every live subscription.

        This is the resync path (`POST /plans/{plan_id}/sync-prices`): the
        plan is named explicitly and every row still owing its price is told
        about it again.

        Args:
            plan_id: Plan whose live rows are pushed.
            now: Instant stamping `price_synced_at`, injected so the tests do
                not depend on the wall clock.

        Returns:
            The push outcome.
        """
        if self.plans.get_by_id(plan_id) is None:
            return PriceSyncResult(0, 0, 0)
        return await self._push(self.subscriptions.list_live_for_plan(plan_id), now)

    async def reconcile_pending(self, *, now: datetime) -> PriceSyncResult:
        """Daily reconciliation: heals every live row that still owes a price.

        The rows that were `failed` by a temporary outage, marked `pending` by
        a mid-checkout edit, or silently left at an older price are all pushed
        with whatever the plan costs today. Rows already `synced` at the
        current price are left alone and counted as skipped.

        Args:
            now: Instant stamping `price_synced_at`, injected so the tests do
                not depend on the wall clock.

        Returns:
            The push outcome across the whole database.
        """
        return await self._push(self.subscriptions.list_all_live(), now)

    async def _push(self, rows: list[Subscription], now: datetime) -> PriceSyncResult:
        """Pushes the plan price of each row and commits the outcome.

        Each row is skipped when the provider already knows its current price;
        otherwise the provider is asked once. A refusal or an unreachable
        provider leaves the row `failed` (never a silent "done") and costs the
        admin's edit nothing — the failure is retried later, not raised.

        Args:
            rows: Live rows to reconcile, plan eager-loaded.
            now: Instant stamping `price_synced_at`.

        Returns:
            The push outcome.
        """
        synced = 0
        failed = 0
        skipped = 0
        for subscription in rows:
            if not _price_drifted(subscription):
                skipped += 1
                continue
            pushed = await self._push_one(subscription, now)
            if pushed:
                synced += 1
            else:
                failed += 1
        self.session.commit()
        return PriceSyncResult(synced, failed, skipped)

    async def _push_one(self, subscription: Subscription, now: datetime) -> bool:
        """Asks the provider for one row's new price and records the answer.

        The row's `price` moves to the new value no matter what (that is what
        the next cycle charges); only the sync status tells whether Asaas
        already knows it. A row with no stored provider id is looked up by our
        reference first — absence of the id is drift, not a pass.

        Args:
            subscription: A live row with drift.
            now: Instant stamping `price_synced_at` on success.

        Returns:
            True when the provider agreed, False when it refused or could not
            be reached (the row is marked `failed`).
        """
        price = subscription.plan.price
        provider_id = subscription.asaas_subscription_id
        if provider_id is None:
            try:
                provider_id, _ = await _find_provider_subscription(
                    self.client,
                    subscription.asaas_customer_id,
                    str(subscription.id),
                )
            except httpx.HTTPError:
                provider_id = None
        if provider_id is None:
            logger.warning(
                "[subscriptions] %s fora do provedor: preço %s marcado para retry",
                subscription.id,
                price,
            )
            subscription.price = price
            subscription.price_sync_status = PRICE_SYNC_FAILED
            return False
        if subscription.asaas_subscription_id is None:
            # The lookup only ran because the id was missing: storing it now is
            # what keeps the next reconciliation (and every later webhook) from
            # paying for the same search again.
            subscription.asaas_subscription_id = provider_id
        try:
            await self.client.update_subscription(provider_id, value=price)
        except httpx.HTTPError as error:
            logger.warning(
                "[subscriptions] sincronização de preço recusada para %s (%s)",
                subscription.id,
                error,
            )
            subscription.price = price
            subscription.price_sync_status = PRICE_SYNC_FAILED
            return False
        subscription.price = price
        subscription.price_sync_status = PRICE_SYNC_SYNCED
        subscription.price_synced_at = now
        return True


class SubscriptionWebhookService:
    """The state machine that turns Asaas events into subscription state (§17).

    The local row is the authority and the provider only reports. Every
    transition is guarded, because the provider documents at-least-once
    delivery **and no ordering** between event types:

    - `CHECKOUT_PAID` is the promotion (§17.2): `incomplete` → `active`, the
      provider subscription id is stored (it is the key of every later event),
      and the paid period starts — without it `resolve_access` fails closed
      and the payer stays free. It is also the P-22 regularize: a `past_due`
      row whose checkout got paid returns to `active`, exactly like a settled
      payment (§17.4 "quem paga volta ao normal sozinho").
    - `CHECKOUT_CANCELED`/`CHECKOUT_EXPIRED` delete a row that never paid, so
      it stops holding the one-open-subscription seat; a paid row is never
      deleted by them.
    - `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` record money: the row goes (back)
      to `active`, the grace window closes and the period advances to the next
      charge — never shortened, because a paid month must not expire early.
    - `PAYMENT_OVERDUE` opens exactly the §17.4 window (`past_due` with grace
      through due + 3 business days), and only from a row that was paying: an
      unpaid `incomplete` checkout has no right to the tolerance.
    - `SUBSCRIPTION_INACTIVATED`/`SUBSCRIPTION_DELETED` cancel without taking
      the month away (§17.5): `current_period_end` keeps granting access.

    The service never commits: the dispatch owns one transaction where the
    event record and the state land together. Identity comes only from the
    provider's ids (`checkout.id`, `subscription.id`, `externalReference`) —
    a `user_id` in the payload is never read (§17.7).
    """

    # Events that end the session without money having arrived.
    _CHECKOUT_CLOSED_EVENTS = frozenset({"CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"})
    # Events that prove money arrived (the provider may send both, in any order).
    _PAYMENT_SETTLED_EVENTS = frozenset({"PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"})
    # Events that close the recurrence at the provider (there is no
    # `SUBSCRIPTION_CANCELED` — the documented names are these two).
    _SUBSCRIPTION_CLOSED_EVENTS = frozenset(
        {"SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED"}
    )

    def __init__(self, session: Session, client: AsaasClient) -> None:
        """Binds the machine to a session and to the provider client.

        Args:
            session: Database session shared with the webhook dispatch.
            client: Asaas client used for the best-effort enrichment of a paid
                checkout (the checkout event carries no subscription id).
        """
        self.repository = SubscriptionRepository(session)
        self.client = client

    async def apply_checkout(
        self, event_type: str, payload: dict, *, now: datetime
    ) -> bool:
        """Applies a `CHECKOUT_*` event to the row the session belongs to.

        Args:
            event_type: Asaas event name.
            payload: Decoded webhook body.
            now: Frozen clock of the dispatch.

        Returns:
            True when a row changed (promoted, enriched, or deleted).
        """
        checkout = payload.get("checkout")
        checkout = checkout if isinstance(checkout, dict) else {}
        checkout_id = checkout.get("id")
        if not isinstance(checkout_id, str) or not checkout_id:
            return False
        subscription = self.repository.get_by_checkout_id(checkout_id)
        if subscription is None:
            return False
        if event_type == "CHECKOUT_PAID":
            return await self._promote(subscription, checkout, now)
        if event_type in self._CHECKOUT_CLOSED_EVENTS:
            if subscription.status != SUBSCRIPTION_STATUS_INCOMPLETE:
                # A paid row must never be erased by a reordered cancel.
                logger.info(
                    "[subscriptions] %s ignorou %s: linha já confirmada",
                    subscription.id,
                    event_type,
                )
                return False
            self.repository.delete(subscription)
            logger.info(
                "[subscriptions] checkout %s encerrado sem pagamento: linha removida",
                checkout_id,
            )
            return True
        return False

    async def _promote(
        self, subscription: Subscription, checkout: dict, now: datetime
    ) -> bool:
        """Promotes a paid checkout to an active subscription.

        The enrichment (provider id + authoritative due date) is best effort:
        the money already moved, so a provider outage must not block
        activation — a later `PAYMENT_*` heals the missing id through
        `checkoutSession`. An `incomplete` row is a fresh promotion; a
        `past_due` row is the P-22 regularize and is reactivated without
        touching its provider id (the recurrence the events match on).

        Args:
            subscription: The local `incomplete` or `past_due` row.
            checkout: The `checkout` object of the payload.
            now: Frozen clock of the dispatch.

        Returns:
            True when something on the row changed.
        """
        provider_id: str | None = None
        provider_due: date | None = None
        if subscription.asaas_subscription_id is None:
            customer = subscription.asaas_customer_id or checkout.get("customer")
            try:
                provider_id, provider_due = await _find_provider_subscription(
                    self.client,
                    customer if isinstance(customer, str) else None,
                    str(subscription.id),
                )
            except httpx.HTTPError:
                logger.warning(
                    "[subscriptions] lookup do provedor indisponível: "
                    "seguindo sem o id do provedor (cliente %s)",
                    customer,
                )
                provider_id, provider_due = None, None

        changed = False
        if subscription.status == SUBSCRIPTION_STATUS_INCOMPLETE:
            checkout_data = checkout.get("subscription")
            checkout_data = checkout_data if isinstance(checkout_data, dict) else {}
            due = parse_asaas_date(checkout_data.get("nextDueDate")) or provider_due
            period_end = _next_charge_boundary(due, now)
            subscription.status = SUBSCRIPTION_STATUS_ACTIVE
            subscription.current_period_start = now
            subscription.current_period_end = period_end
            subscription.next_billing_date = period_end
            subscription.grace_until = None
            changed = True
            logger.info(
                "[subscriptions] CHECKOUT_PAID confirmou %s (próximo ciclo %s)",
                subscription.id,
                period_end.isoformat(),
            )
        elif subscription.status == SUBSCRIPTION_STATUS_PAST_DUE:
            # The P-22 regularize (opção A): the checkout of the overdue
            # journey was paid, so §17.4's "quem paga volta ao normal sozinho"
            # reactivates the row exactly like a settled payment does — money
            # for `due` arrived, the grace window closes and the period moves
            # to the next charge, never backward. The provider id is left
            # untouched: it names the recurrence every later event matches on.
            subscription.status = SUBSCRIPTION_STATUS_ACTIVE
            changed = True
            if subscription.grace_until is not None:
                subscription.grace_until = None
            checkout_data = checkout.get("subscription")
            checkout_data = checkout_data if isinstance(checkout_data, dict) else {}
            due = parse_asaas_date(checkout_data.get("nextDueDate")) or provider_due
            if due is not None:
                period_end = _business_start(add_billing_month(due))
                current_end = as_utc(subscription.current_period_end)
                if current_end is None or period_end > current_end:
                    subscription.current_period_end = period_end
                    subscription.next_billing_date = period_end
                    logger.info(
                        "[subscriptions] CHECKOUT_PAID regularizou %s "
                        "(próximo ciclo %s)",
                        subscription.id,
                        period_end.isoformat(),
                    )

        if provider_id and subscription.asaas_subscription_id is None:
            subscription.asaas_subscription_id = provider_id
            changed = True
        if changed and _price_drifted(subscription):
            # The plan's price moved while the checkout sat open: the first
            # charge (already generated by the provider) keeps the price the
            # session was opened at, so the row is activated and flagged
            # `pending` — the daily reconciliation pushes the new value before
            # the next charge is generated. There is no silent "synced": the
            # flag lives or dies by the provider knowing the current price.
            subscription.price_sync_status = PRICE_SYNC_PENDING
        return changed

    def apply_subscription(
        self, event_type: str, payload: dict, *, now: datetime
    ) -> bool:
        """Applies a `SUBSCRIPTION_*` lifecycle event to the local row.

        Cancellation ends the recurrence, not the paid month (§17.5): the row
        becomes `canceled` and `current_period_end` keeps granting access until
        it passes. The match tries the provider id first and falls back to
        `externalReference` — the fallback is what saves a row whose
        enrichment of `CHECKOUT_PAID` never succeeded.

        Args:
            event_type: Asaas event name.
            payload: Decoded webhook body.
            now: Frozen clock of the dispatch (`canceled_at`).

        Returns:
            True when the row changed.
        """
        if event_type not in self._SUBSCRIPTION_CLOSED_EVENTS:
            return False
        data = payload.get("subscription")
        data = data if isinstance(data, dict) else {}
        provider_id = data.get("id")
        subscription: Subscription | None = None
        if isinstance(provider_id, str) and provider_id:
            subscription = self.repository.get_by_provider_subscription_id(provider_id)
        if subscription is None:
            reference = data.get("externalReference")
            if isinstance(reference, str) and reference:
                subscription = self.repository.get_by_external_reference(reference)
        if subscription is None:
            return False
        if subscription.status == SUBSCRIPTION_STATUS_CANCELED:
            return False
        if (
            isinstance(provider_id, str)
            and provider_id
            and not subscription.asaas_subscription_id
        ):
            subscription.asaas_subscription_id = provider_id
        subscription.status = SUBSCRIPTION_STATUS_CANCELED
        subscription.canceled_at = now
        logger.info("[subscriptions] %s cancelada por %s", subscription.id, event_type)
        return True

    def find_for_payment(self, payment: dict) -> Subscription | None:
        """Locates the subscription a `PAYMENT_*` event belongs to (§17.7).

        Only provider-owned facts identify the row: the provider's
        subscription id, then the checkout session id (the fallback that
        covers a row whose enrichment failed). The payload's `user_id`, if it
        ever carries one, is not a key — identity never comes from the client.

        Args:
            payment: The `payment` object of the event.

        Returns:
            The matching row, or `None`.
        """
        if not isinstance(payment, dict):
            return None
        provider_id = payment.get("subscription")
        if isinstance(provider_id, str) and provider_id:
            subscription = self.repository.get_by_provider_subscription_id(provider_id)
            if subscription is not None:
                return subscription
        checkout_id = payment.get("checkoutSession")
        if isinstance(checkout_id, str) and checkout_id:
            return self.repository.get_by_checkout_id(checkout_id)
        return None

    def apply_payment(
        self,
        event_type: str,
        subscription: Subscription,
        payment: dict,
        *,
        now: datetime,
    ) -> bool:
        """Applies a `PAYMENT_*` event to the matched subscription.

        Settled money (`CONFIRMED`/`RECEIVED`) activates the row, closes any
        grace window, heals a missing provider id and advances the period to
        the next charge — only ever forward: a charge for the current month
        must not shorten a period an earlier event already granted. A
        `canceled` row stays canceled; the payment history still records the
        money, but a late event does not resurrect a closed subscription.

        `OVERDUE` opens §17.4's tolerance: `past_due` with `grace_until` at
        the end of due + 3 business days, and only from a row that was paying.

        Args:
            event_type: Asaas event name.
            subscription: The matched local row.
            payment: The `payment` object of the payload.
            now: Frozen clock of the dispatch (promotion start).

        Returns:
            True when the row changed.
        """
        if event_type in self._PAYMENT_SETTLED_EVENTS:
            return self._settle(subscription, payment, now)
        if event_type == "PAYMENT_OVERDUE":
            return self._open_grace(subscription, payment)
        return False

    def _settle(self, subscription: Subscription, payment: dict, now: datetime) -> bool:
        """Activates the row for money that arrived and advances its period.

        Args:
            subscription: The matched local row.
            payment: The `payment` object of the payload.
            now: Frozen clock of the dispatch.

        Returns:
            True when the row changed.
        """
        if subscription.status == SUBSCRIPTION_STATUS_CANCELED:
            return False
        changed = False
        if subscription.status == SUBSCRIPTION_STATUS_INCOMPLETE:
            subscription.status = SUBSCRIPTION_STATUS_ACTIVE
            subscription.current_period_start = now
            changed = True
        elif subscription.status == SUBSCRIPTION_STATUS_PAST_DUE:
            subscription.status = SUBSCRIPTION_STATUS_ACTIVE
            changed = True
        if subscription.grace_until is not None:
            subscription.grace_until = None
            changed = True
        provider_id = payment.get("subscription")
        if (
            isinstance(provider_id, str)
            and provider_id
            and not subscription.asaas_subscription_id
        ):
            subscription.asaas_subscription_id = provider_id
            changed = True
        due = parse_asaas_date(payment.get("dueDate"))
        if due is not None:
            # The charge for `due` was paid, so access runs until the day the
            # following charge begins.
            period_end = _business_start(add_billing_month(due))
            current_end = as_utc(subscription.current_period_end)
            if current_end is None or period_end > current_end:
                subscription.current_period_end = period_end
                subscription.next_billing_date = period_end
                changed = True
        return changed

    def _open_grace(self, subscription: Subscription, payment: dict) -> bool:
        """Opens the §17.4 dunning window: `past_due`, grace to due + 3 days.

        The end of a business day is the start of the next one, which is why
        the grace instant is due + 4 days at São Paulo midnight (03:00 UTC):
        the user keeps the tolerance through the *end* of the third day.

        Args:
            subscription: The matched local row.
            payment: The `payment` object of the payload.

        Returns:
            True when the row changed.
        """
        if subscription.status not in (
            SUBSCRIPTION_STATUS_ACTIVE,
            SUBSCRIPTION_STATUS_PAST_DUE,
        ):
            # An unpaid checkout (or a closed one) never earned the tolerance.
            logger.info(
                "[subscriptions] PAYMENT_OVERDUE ignorado para %s: status %s",
                subscription.id,
                subscription.status,
            )
            return False
        due = parse_asaas_date(payment.get("dueDate"))
        if due is None:
            logger.warning(
                "[subscriptions] PAYMENT_OVERDUE sem vencimento legível para %s: "
                "janela de tolerância não aberta",
                subscription.id,
            )
            return False
        # Out-of-order delivery (AUD-008): when the period already runs past the
        # one this charge pays for, the charge was settled and the notice is
        # stale, so it must not reopen the dunning window.
        paid_through = _business_start(add_billing_month(due))
        current_end = as_utc(subscription.current_period_end)
        if current_end is not None and current_end >= paid_through:
            logger.info(
                "[subscriptions] PAYMENT_OVERDUE ignorado para %s: cobrança de %s já paga",
                subscription.id,
                due,
            )
            return False
        grace_until = _business_start(due + timedelta(days=4))
        changed = False
        if subscription.status != SUBSCRIPTION_STATUS_PAST_DUE:
            subscription.status = SUBSCRIPTION_STATUS_PAST_DUE
            changed = True
        current_grace = as_utc(subscription.grace_until)
        if current_grace is None or grace_until > current_grace:
            subscription.grace_until = grace_until
            changed = True
        return changed


class SubscriptionCancelService:
    """Cancels what the caller has open — at the provider first (§17.5).

    The provider owns the recurrence, so it stops before our mirror moves:
    cancelling only locally would leave Asaas charging someone who was told
    they stopped paying, and the next settled payment would land on a row
    that refuses it. The mirror only moves after the provider confirmed —
    including a 404, which means the recurrence is already gone.

    Args:
        session: Database session.
        client: Provider client, injected so the flow is testable offline.
    """

    def __init__(self, session: Session, client: AsaasClient) -> None:
        """Binds the service to a session and to the provider.

        Args:
            session: Database session.
            client: Asaas client.
        """
        self.session = session
        self.client = client
        self.subscriptions = SubscriptionRepository(session)

    async def cancel(self, actor: UserResponse, *, now: datetime) -> CancelResponse:
        """Cancels the caller's subscription, or discards their unpaid checkout.

        There is no id in the request: the row comes from the session's user
        (§17.7), so no client-sent identity can reach another person's row.

        Args:
            actor: Authenticated user making the request.
            now: Frozen clock stamping `canceled_at`.

        Returns:
            The paid-through instant the confirmation screen shows; `null`
            when an abandoned checkout was discarded instead.

        Raises:
            HTTPException: 404 when the user has nothing to cancel, 502 when
                the provider refuses or cannot be asked.
        """
        subscription = self.subscriptions.get_cancel_target(actor.id)
        if subscription is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Nenhuma assinatura para cancelar.",
            )
        if subscription.status == SUBSCRIPTION_STATUS_CANCELED:
            return CancelResponse(
                current_period_end=as_utc(subscription.current_period_end)
            )
        if subscription.status == SUBSCRIPTION_STATUS_INCOMPLETE:
            discarded = subscription.asaas_checkout_id or str(subscription.id)
            await self._discard_checkout(subscription)
            self.subscriptions.delete(subscription)
            self.session.commit()
            logger.info(
                "[subscriptions] checkout %s descartado pelo usuário", discarded
            )
            return CancelResponse(current_period_end=None)
        await self._stop_recurrence(subscription)
        subscription.status = SUBSCRIPTION_STATUS_CANCELED
        subscription.canceled_at = now
        subscription.grace_until = None
        self.session.commit()
        logger.info("[subscriptions] %s cancelada pelo usuário", subscription.id)
        return CancelResponse(
            current_period_end=as_utc(subscription.current_period_end)
        )

    async def _stop_recurrence(self, subscription: Subscription) -> None:
        """Stops future charges at the provider, however we must find them.

        Args:
            subscription: The local row being cancelled.

        Raises:
            HTTPException: 502 when the provider refuses or is unreachable —
                the local row is never cancelled on a failed stop.
        """
        provider_id = subscription.asaas_subscription_id
        if provider_id is None:
            provider_id = await self._lookup_provider_id(subscription)
        if provider_id is None:
            logger.info(
                "[subscriptions] %s sem assinatura no provedor: "
                "cancelamento apenas local",
                subscription.id,
            )
            return
        try:
            await self.client.cancel_subscription(provider_id)
        except httpx.HTTPStatusError as error:
            if error.response.status_code == 404:
                logger.info(
                    "[subscriptions] assinatura %s já removida no provedor",
                    provider_id,
                )
                return
            self._refuse(error, operation="cancelamento da assinatura")
        except httpx.HTTPError as error:
            self._refuse(error, operation="cancelamento da assinatura")

    async def _lookup_provider_id(self, subscription: Subscription) -> str | None:
        """Asks the provider for the subscription when our stored id is missing.

        Args:
            subscription: The local row being cancelled.

        Returns:
            The provider id, or `None` when the provider has nothing matching
            our reference for this customer.

        Raises:
            HTTPException: 502 when the provider cannot be asked — cancelling
                blind is how a recurrence survives a cancel.
        """
        try:
            provider_id, _ = await _find_provider_subscription(
                self.client,
                subscription.asaas_customer_id,
                str(subscription.id),
            )
        except httpx.HTTPError as error:
            self._refuse(error, operation="listagem de assinaturas")
        return provider_id

    async def _discard_checkout(self, subscription: Subscription) -> None:
        """Closes the hosted session of an unpaid checkout before dropping it.

        Args:
            subscription: The `incomplete` local row.

        Raises:
            HTTPException: 502 when the provider refuses — the session may
                still be payable, so nothing is discarded.
        """
        checkout_id = subscription.asaas_checkout_id
        if checkout_id is None:
            logger.info(
                "[subscriptions] %s sem sessão registrada: descartando localmente",
                subscription.id,
            )
            return
        try:
            await self.client.cancel_checkout(checkout_id)
        except httpx.HTTPStatusError as error:
            if error.response.status_code == 404:
                logger.info(
                    "[subscriptions] sessão %s já não existe no provedor",
                    checkout_id,
                )
                return
            self._refuse(error, operation="fechamento da sessão de checkout")
        except httpx.HTTPError as error:
            self._refuse(error, operation="fechamento da sessão de checkout")

    def _refuse(self, error: Exception, *, operation: str) -> NoReturn:
        """Rolls back and answers 502 with our words instead of the provider's.

        Args:
            error: The failure being translated; only its URL and status are
                ever logged, never a response body (§1).
            operation: Which call failed, for the log.

        Raises:
            HTTPException: Always — 502 with the safe cancel message.
        """
        logger.warning(
            "[subscriptions] cancelamento: %s falhou no provedor (%s)",
            operation,
            error,
        )
        self.session.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível cancelar. Tente novamente.",
        ) from error


async def run_price_reconciliation(*, now: datetime | None = None) -> PriceSyncResult:
    """Runs the daily price reconciliation on its own session.

    The Rocketry task of the scheduler calls this instead of building a session
    itself: the service owns the commit and the close, so neither leaks when
    the provider refuses a row.

    Args:
        now: Instant stamping `price_synced_at`; defaults to the current UTC
            time.

    Returns:
        The push outcome across the whole database.
    """
    session = SessionLocal()
    try:
        result = await PricePropagationService(
            session, AsaasClient()
        ).reconcile_pending(now=now or datetime.now(UTC))
        logger.info(
            "[subscriptions] reconciliação diária de preços: %s",
            result,
        )
        return result
    finally:
        session.close()
