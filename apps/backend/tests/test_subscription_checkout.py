"""Opening a hosted checkout — where a subscription actually starts (§17.2, Fase 4).

Seven rules are protected here, and each one was a plausible silent bug:

1. **The price comes from the database, never from the browser.** `plans.price`
   is the source of truth (§17.1), so a `price` in the body is refused with a 422
   instead of being ignored: a client that sends one believes it is paying that.
2. **The Asaas customer is reused.** A second `create_customer` for the same person
   splits their payment history in two inside the provider.
3. **`externalReference` is our subscription id.** It is what Asaas documents
   for reconciliation, so a wrong value breaks anything (us or them) that
   matches a payment back to a subscription by it.
4. **The row is created `incomplete` and not `active`.** Creating the session does
   not pay: only `CHECKOUT_PAID` confirms. A row marked active before the money
   arrives hands out a paid plan to anyone who opens a link.
5. **One live subscription per person** (`uq_subscriptions_open_per_user`). The
   second attempt is refused before Asaas is called, so the buyer is not left with
   a session nobody will confirm.
6. **A beta pays only after the free year** (§17.6): the first charge is dated the
   day after `beta_access.expires_at`, never today.
7. **The checkout id is stored** (P-16): the `CHECKOUT_*` webhook payload carries
   only `checkout.id` — no `externalReference`, no subscription id — so a session
   the provider answers without an id is refused with the same 502 as one
   without a link.

The response is a contract: the exact keys are asserted, because §6 says a field
ships only if the page reads it.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.core.asaas_client import AsaasClient
from src.core.config import get_settings
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.subscriptions.models import (
    SUBSCRIPTION_STATUS_INCOMPLETE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    BetaAccess,
    BillingProfile,
    Plan,
    Subscription,
)
from src.modules.subscriptions.schemas import BillingData, CheckoutCreate
from src.modules.subscriptions.service import CheckoutService
from tests.helpers import TEST_PASSWORD, create_test_user

FIXED_NOW = datetime(2026, 10, 5, 12, 0, tzinfo=UTC)

# A complete billing payload: the Asaas Checkout refuses to open without one
# (§17.8), and every test that opens a checkout needs it.
BILLING = {
    "cpf_cnpj": "24971563792",
    "phone": "(47) 3801-0919",
    "address": "Av. Paulista",
    "address_number": "150",
    "city": "São Paulo",
    "state": "sp",
    "postal_code": "01310-000",
}


def _login_as(client, email: str) -> dict:
    """Logs in as a user the fixture already created.

    `auth_header` registers the user first, which cannot be reused here: the actor
    exists, and a second insert of the same e-mail breaks the unique index.

    Args:
        client: FastAPI test client.
        email: E-mail of the existing user.

    Returns:
        The authorization header.
    """
    response = client.post(
        "/auth/login", data={"username": email, "password": TEST_PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _run(coroutine):
    """Runs a coroutine to completion.

    `pytest-asyncio` is not a dependency of this project and the checkout is
    called from an async router, so the tests drive it directly.

    Args:
        coroutine: The coroutine to run.

    Returns:
        Whatever the coroutine returned.
    """
    import asyncio

    return asyncio.run(coroutine)


EXPECTED_KEYS = {"link", "plan_name", "price", "cycle", "status"}


@pytest.fixture
def provider(monkeypatch):
    """Serves fake Asaas responses and records what the client asked for.

    The transport is swapped with `httpx.MockTransport`, so the checkout runs as
    it does in production while the test stays offline: `AsaasClient` reads the
    key and the base URL from the settings, and without this the suite would bill
    the real sandbox.

    Args:
        monkeypatch: pytest monkeypatch fixture.

    Returns:
        A mutable object with the recorded `requests` and the `payload` the fake
        provider answers with.
    """

    class Provider:
        def __init__(self) -> None:
            self.requests: list[httpx.Request] = []
            self.status = 200
            self.payload: dict = {
                "id": "chk_1",
                "link": "https://sandbox.asaas.com/000/checkoutSession/show/chk_1",
                "status": "ACTIVE",
            }

        def calls_to(self, path: str) -> list[httpx.Request]:
            """Selects the recorded requests that hit a path.

            Args:
                path: Endpoint suffix, e.g. `/checkouts`.

            Returns:
                The matching requests, in order.
            """
            return [r for r in self.requests if r.url.path.endswith(path)]

        @property
        def checkout(self) -> httpx.Request:
            """The request that opened the checkout.

            Returns:
                The last `POST /checkouts` request.

            Raises:
                AssertionError: When no checkout was created.
            """
            calls = self.calls_to("/checkouts")
            assert calls, "no checkout was created"
            return calls[-1]

        def body_of(self, request: httpx.Request) -> dict:
            """Decodes the JSON body of a recorded request.

            Args:
                request: Recorded request.

            Returns:
                The decoded body.
            """
            return json.loads(request.content)

    fake = Provider()

    def handler(request: httpx.Request) -> httpx.Response:
        fake.requests.append(request)
        # The customer and the checkout are different objects: answering both
        # with the checkout payload would store a checkout id as a customer id.
        if request.url.path.endswith("/customers"):
            return httpx.Response(
                200,
                json={"id": "cus_1", "name": "Test User", "email": "test@cafe.com"},
            )
        return httpx.Response(fake.status, json=fake.payload)

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        # The real class is captured before the patch: looking it up through the
        # module attribute would call the factory itself.
        return real_client_cls(*args, **kwargs)

    real_client_cls = httpx.AsyncClient
    monkeypatch.setenv("ASAAS_API_KEY", "asaas-api-key-for-tests")
    monkeypatch.setenv("ASAAS_BASE_URL", "https://api.asaas.com/api/v3")
    monkeypatch.setenv("MODE", "test")
    get_settings.cache_clear()
    monkeypatch.setattr(httpx, "AsyncClient", factory)
    try:
        yield fake
    finally:
        get_settings.cache_clear()


@pytest.fixture
def plan(db_session: Session) -> Plan:
    """Seeds the monthly plan at R$ 27,90.

    Args:
        db_session: Database session.

    Returns:
        The active plan.
    """
    seeded = Plan(
        id=uuid4(),
        code="mensal",
        name="Cafe com BPO - Mensal",
        price=Decimal("27.90"),
        cycle="MONTHLY",
        is_active=True,
        description="Assinatura mensal",
    )
    db_session.add(seeded)
    db_session.commit()
    return seeded


@pytest.fixture
def actor(db_session: Session) -> UserResponse:
    """An authenticated user with no Asaas customer yet.

    Args:
        db_session: Database session.

    Returns:
        The user as the router hands it to the service.
    """
    email = f"checkout_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")
    # The helper closes its own session, so the actor is re-read by e-mail
    # instead of reusing an object detached from `db_session`.
    return UserResponse.from_user(
        db_session.query(User).filter(User.email == email).one()
    )


def _open(db_session: Session, actor: UserResponse, plan: Plan) -> object:
    """Opens a checkout with a frozen clock.

    Args:
        db_session: Database session.
        actor: Authenticated user.
        plan: Plan being bought.

    Returns:
        The checkout response.
    """
    return _run(
        CheckoutService(db_session, AsaasClient()).open_checkout(
            actor,
            CheckoutCreate(plan_id=plan.id, billing=BillingData(**BILLING)),
            now=FIXED_NOW,
        )
    )


def test_checkout_returns_the_link_and_marks_the_row_incomplete(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The session is a promise to pay, not a paid subscription.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    response = _open(db_session, actor, plan)

    assert response.link == provider.payload["link"]
    assert response.status == SUBSCRIPTION_STATUS_INCOMPLETE
    assert set(response.model_dump()) == EXPECTED_KEYS

    row = db_session.query(Subscription).filter(Subscription.user_id == actor.id).one()
    assert row.status == SUBSCRIPTION_STATUS_INCOMPLETE
    assert row.price == Decimal("27.90")
    assert row.cycle == "MONTHLY"
    assert row.plan_id == plan.id
    # The provider has not paid yet, so there is no subscription over there.
    assert row.asaas_subscription_id is None


def test_the_checkout_id_is_stored_for_the_webhook(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The `CHECKOUT_*` payload carries only `checkout.id` — nothing else finds us.

    The webhook of Fase 5 receives `checkout.id`, `event` and the payer's
    customer id; it does **not** carry the `externalReference` we sent. Without
    this column the activation of a paid session would have nothing to match
    against (P-16).

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    row = db_session.query(Subscription).filter(Subscription.user_id == actor.id).one()
    assert row.asaas_checkout_id == provider.payload["id"]


def test_a_checkout_without_an_id_is_refused(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """A session we cannot recognise later is as useless as one without a link.

    Args:
        provider: Fake Asaas provider, answering without an id.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    provider.payload = {
        "link": "https://sandbox.asaas.com/000/checkoutSession/show/chk_1",
        "status": "ACTIVE",
    }

    with pytest.raises(HTTPException) as raised:
        _open(db_session, actor, plan)

    assert raised.value.status_code == 502
    db_session.rollback()
    assert db_session.query(Subscription).count() == 0


def test_the_price_never_comes_from_the_body(provider, db_session, plan, actor):
    """§17.1: a `price` in the body is a 422, not a value we honour or ignore.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CheckoutCreate(plan_id=plan.id, price=Decimal("0.01"))


def test_the_strict_schema_answers_422_for_a_price_in_the_request(
    client, db_session, plan
):
    """The router rejects the field before the service is reached.

    Args:
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
    """
    from tests.helpers import auth_header, unique_email

    headers = auth_header(client, unique_email("checkout_422"))

    response = client.post(
        "/subscriptions/checkout",
        json={"plan_id": str(plan.id), "price": "0.01"},
        headers=headers,
    )

    assert response.status_code == 422
    db_session.rollback()


def test_the_checkout_carries_the_plan_price_and_our_reference(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The body Asaas receives is the one Fase 5 depends on.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    row = db_session.query(Subscription).filter(Subscription.user_id == actor.id).one()
    body = provider.body_of(provider.checkout)
    assert body["items"][0]["value"] == 27.90
    assert body["subscription"]["cycle"] == "MONTHLY"
    # The webhook matches on this; it is the whole point of the call.
    assert body["externalReference"] == str(row.id)


def test_a_beta_pays_only_after_the_free_year(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """§17.6: nobody is charged for the period they already have for free.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    db_session.add(
        BetaAccess(
            id=uuid4(),
            user_id=actor.id,
            granted_at=FIXED_NOW - timedelta(days=300),
            expires_at=FIXED_NOW + timedelta(days=65),
        )
    )
    db_session.commit()

    _open(db_session, actor, plan)

    body = provider.body_of(provider.checkout)
    assert (
        body["subscription"]["nextDueDate"]
        == (FIXED_NOW.date() + timedelta(days=66)).isoformat()
    )


def test_a_beta_that_already_ended_pays_today(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """An expired grant must not push the charge into the past.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    db_session.add(
        BetaAccess(
            id=uuid4(),
            user_id=actor.id,
            granted_at=FIXED_NOW - timedelta(days=400),
            expires_at=FIXED_NOW - timedelta(days=35),
        )
    )
    db_session.commit()

    _open(db_session, actor, plan)

    body = provider.body_of(provider.checkout)
    assert body["subscription"]["nextDueDate"] == FIXED_NOW.date().isoformat()


def test_without_a_beta_the_charge_is_dated_today(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """A regular buyer is charged now, not on a date we invented.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    body = provider.body_of(provider.checkout)
    assert body["subscription"]["nextDueDate"] == FIXED_NOW.date().isoformat()


def test_an_unknown_plan_is_a_404(provider, db_session: Session, actor: UserResponse):
    """Nothing is created when the plan does not exist.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        actor: Authenticated user.
    """
    with pytest.raises(HTTPException) as raised:
        _run(
            CheckoutService(db_session, AsaasClient()).open_checkout(
                actor,
                CheckoutCreate(plan_id=uuid4(), billing=BillingData(**BILLING)),
                now=FIXED_NOW,
            )
        )

    assert raised.value.status_code == 404
    assert provider.requests == []


def test_a_deactivated_plan_cannot_be_bought(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Deactivation is the whole lifecycle: an inactive plan is not sellable.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan, deactivated here.
        actor: Authenticated user.
    """
    plan.is_active = False
    db_session.commit()

    with pytest.raises(HTTPException) as raised:
        _open(db_session, actor, plan)

    assert raised.value.status_code == 422
    assert provider.requests == []


def test_a_second_subscription_is_refused_before_asaas_is_called(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """One live subscription per person, and no orphan session in the meantime.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    db_session.add(
        Subscription(
            id=uuid4(),
            user_id=actor.id,
            plan_id=plan.id,
            status="active",
            cycle="MONTHLY",
            price=Decimal("27.90"),
            asaas_subscription_id="sub_existing",
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as raised:
        _open(db_session, actor, plan)

    assert raised.value.status_code == 409
    assert provider.requests == [], "a refused buyer must not get a live session"


# --- Regularizar um pagamento em atraso (P-22, decisão do dono: opção A) ------
# §17.4 says "quem paga dentro da janela volta ao normal sozinho": the past_due
# user must be able to pay, and the platform's own authority signal for paying is
# the checkout. The 409 of the one-open-subscription rule applies to someone who
# already has a live *active* subscription — exactly the person with nothing to
# regularize — while a `past_due` row re-attaches to the same checkout, because a
# second row would trip `uq_subscriptions_open_per_user`.


def test_a_past_due_user_can_reopen_the_checkout_to_regularize(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The overdue subscriber is back on the card journey, on the same row.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user with a past_due subscription on the plan.
    """
    overdue = Subscription(
        id=uuid4(),
        user_id=actor.id,
        plan_id=plan.id,
        status=SUBSCRIPTION_STATUS_PAST_DUE,
        cycle="MONTHLY",
        price=Decimal("27.90"),
        asaas_subscription_id="sub_regularize",
        current_period_end=FIXED_NOW - timedelta(days=30),
        grace_until=FIXED_NOW + timedelta(days=2),
    )
    db_session.add(overdue)
    db_session.commit()

    response = _open(db_session, actor, plan)

    assert response.status == SUBSCRIPTION_STATUS_PAST_DUE
    assert response.link == provider.payload["link"]
    body = provider.body_of(provider.checkout)
    # The session travels attached to the row the webhook already knows.
    assert body["externalReference"] == str(overdue.id)
    rows = db_session.query(Subscription).filter(Subscription.user_id == actor.id).all()
    assert len(rows) == 1, "regularizing must not mint a second open row"
    row = rows[0]
    assert row.id == overdue.id
    assert row.status == SUBSCRIPTION_STATUS_PAST_DUE
    assert row.asaas_checkout_id == provider.payload["id"]


def test_a_past_due_user_cannot_regularize_with_another_plan(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Regularize pays the overdue charge; switching plans is not that action.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan the user is overdue on.
        actor: Authenticated user with a past_due subscription on `plan`.
    """
    another = Plan(
        id=uuid4(),
        code="anual",
        name="Cafe com BPO - Anual",
        price=Decimal("279.00"),
        cycle="MONTHLY",
        is_active=True,
    )
    db_session.add(another)
    db_session.add(
        Subscription(
            id=uuid4(),
            user_id=actor.id,
            plan_id=plan.id,
            status=SUBSCRIPTION_STATUS_PAST_DUE,
            cycle="MONTHLY",
            price=Decimal("27.90"),
            asaas_subscription_id="sub_regularize",
        )
    )
    db_session.commit()

    with pytest.raises(HTTPException) as raised:
        _run(
            CheckoutService(db_session, AsaasClient()).open_checkout(
                actor,
                CheckoutCreate(plan_id=another.id, billing=BillingData(**BILLING)),
                now=FIXED_NOW,
            )
        )

    assert raised.value.status_code == 409
    assert provider.requests == [], "a mismatch is refused before the provider"


def test_the_asaas_customer_is_created_once_and_then_reused(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Two customers for one person split their history inside the provider.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    user = db_session.get(User, actor.id)
    assert user.asaas_customer_id == "cus_1"
    assert len(provider.calls_to("/customers")) == 1

    # A second attempt for the same person must reuse the customer.
    db_session.query(Subscription).delete()
    db_session.commit()

    _open(db_session, actor, plan)

    assert len(provider.calls_to("/customers")) == 1


def test_the_buyer_name_and_email_reach_asaas(provider, db_session, plan, actor):
    """The hosted page greets the buyer and Asaas validates the document.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    body = provider.body_of(provider.calls_to("/customers")[0])
    assert body["email"] == actor.email
    assert body["name"]


def test_the_session_carries_no_card_data(provider, db_session, plan, actor):
    """The one thing the hosted checkout buys us (§17.2).

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    for request in provider.requests:
        serialized = request.content.decode()
        for field in ("creditCard", "cardNumber", "ccv", "creditCardToken"):
            assert field not in serialized


def test_the_callbacks_come_from_the_configured_frontend_url(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Asaas redirects the buyer, so the URL has to be a real frontend page.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    callback = provider.body_of(provider.checkout)["callback"]
    frontend = get_settings().frontend_url.rstrip("/")
    assert callback["successUrl"].startswith(frontend)
    assert callback["cancelUrl"].startswith(frontend)


def test_a_localhost_frontend_url_warns_loudly(
    db_session: Session, monkeypatch, caplog
):
    """A `localhost` callback host is refused by Asaas, so it must not be silent.

    The provider answers 400 `"O campo successUrl é inválido"` for `localhost`,
    which the user sees only as the opaque 502 from `_call_provider`. The URL is
    still built (the guard never changes behavior), but the log carries a warning
    that names the misconfiguration instead of reading as a provider outage.

    Args:
        db_session: Database session.
        monkeypatch: pytest monkeypatch fixture.
        caplog: pytest captured-log records.
    """
    settings = get_settings()
    monkeypatch.setattr(
        # `get_settings()` is lru_cached; the attribute swap is undone by
        # monkeypatch so no other test inherits a localhost frontend.
        settings,
        "frontend_url",
        "http://localhost",
    )
    service = CheckoutService(db_session, AsaasClient())
    with caplog.at_level(logging.WARNING, logger="src.modules.subscriptions.service"):
        url = service._callback_url("/painel/pagamentos?checkout=paid")

    assert url == "http://localhost/painel/pagamentos?checkout=paid"
    assert any(
        "localhost" in record.message and "FRONTEND_URL" in record.message
        for record in caplog.records
    )


def test_a_non_localhost_frontend_url_is_silent(
    db_session: Session, monkeypatch, caplog
):
    """Only the `localhost` hostname is refused by Asaas — IPv4 and public hosts pass.

    Args:
        db_session: Database session.
        monkeypatch: pytest monkeypatch fixture.
        caplog: pytest captured-log records.
    """
    settings = get_settings()
    monkeypatch.setattr(settings, "frontend_url", "http://127.0.0.1")
    service = CheckoutService(db_session, AsaasClient())
    with caplog.at_level(logging.WARNING, logger="src.modules.subscriptions.service"):
        url = service._callback_url("/painel/pagamentos?checkout=paid")

    assert url == "http://127.0.0.1/painel/pagamentos?checkout=paid"
    assert not caplog.records


def test_a_subscription_id_is_never_taken_from_the_body(
    provider, client, db_session, plan, actor
):
    """The id is ours to mint; a client-supplied one would point at history.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        CheckoutCreate(plan_id=plan.id, user_id=uuid4())

    assert isinstance(UUID(str(plan.id)), UUID)


# --- Billing data (§17.8) ------------------------------------------------------
# The Checkout refuses to open without a document, a phone and an address, and
# it refuses a masked phone. These tests pin what we do with that data: save it
# once, normalize it before it travels, and never show it to another person.


def test_a_checkout_without_billing_data_is_refused(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Asking the provider first and failing afterwards is a dead end for the user.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user with no saved billing data.
    """
    with pytest.raises(HTTPException) as raised:
        _run(
            CheckoutService(db_session, AsaasClient()).open_checkout(
                actor, CheckoutCreate(plan_id=plan.id), now=FIXED_NOW
            )
        )

    assert raised.value.status_code == 422
    assert "cobrança" in raised.value.detail
    assert provider.requests == [], "no customer may be created before the check"


def test_the_billing_data_is_saved_and_sent_to_the_provider(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Saved so nobody types it twice, normalized before it travels.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)

    profile = db_session.query(BillingProfile).filter_by(user_id=actor.id).one()
    # The phone is stored as the provider needs it, not as it was typed.
    assert profile.phone == "4738010919"
    assert profile.cpf_cnpj == "24971563792"
    assert profile.state == "SP"

    body = provider.body_of(provider.calls_to("/customers")[0])
    assert body["cpfCnpj"] == "24971563792"
    assert body["phone"] == "4738010919"
    assert body["postalCode"] == "01310000"


def test_a_second_checkout_reuses_the_saved_billing_data(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Reopening a journey must not ask for the same address again.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)
    db_session.query(Subscription).delete()
    db_session.commit()
    before = len(provider.calls_to("/customers"))

    _open(db_session, actor, plan)

    body = provider.body_of(provider.checkout)
    assert body["customer"], "the saved Asaas customer must be reused"
    assert len(provider.calls_to("/customers")) == before, (
        "an unchanged address must not cost a provider call"
    )


def test_changing_the_address_updates_both_sides(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """A moved person has to reach the provider, not only our database.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    _open(db_session, actor, plan)
    db_session.query(Subscription).delete()
    db_session.commit()

    moved = {**BILLING, "address": "Rua Nova", "address_number": "42"}
    _run(
        CheckoutService(db_session, AsaasClient()).open_checkout(
            actor,
            CheckoutCreate(plan_id=plan.id, billing=BillingData(**moved)),
            now=FIXED_NOW,
        )
    )

    profile = db_session.query(BillingProfile).filter_by(user_id=actor.id).one()
    assert profile.address == "Rua Nova"

    # `calls_to` matches an exact path suffix, so the update is found by method:
    # its path carries the customer id.
    updates = [r for r in provider.requests if r.method == "PUT"]
    assert len(updates) == 1, "the provider was not told about the new address"
    assert provider.body_of(updates[0])["address"] == "Rua Nova"


def test_the_saved_billing_data_is_private(provider, client, db_session, plan, actor):
    """One person never reads another's document.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
        actor: Owner of the billing data.
    """
    from tests.helpers import auth_header, unique_email

    _open(db_session, actor, plan)

    intruder = auth_header(client, unique_email("intruder"))
    mine = client.get("/subscriptions/billing", headers=intruder)
    other = client.get("/subscriptions/billing", headers=_login_as(client, actor.email))

    assert mine.status_code == 404
    assert other.status_code == 200
    assert other.json()["cpf_cnpj"] == "24971563792"


def test_the_billing_screen_gets_the_saved_data_to_prefill(
    provider, client, db_session, plan, actor
):
    """The form must not start empty for someone who already filled it in.

    Args:
        provider: Fake Asaas provider.
        client: FastAPI test client.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """

    _open(db_session, actor, plan)

    response = client.get(
        "/subscriptions/billing", headers=_login_as(client, actor.email)
    )

    assert response.status_code == 200
    assert response.json() == {
        "cpf_cnpj": "24971563792",
        "phone": "4738010919",
        "address": "Av. Paulista",
        "address_number": "150",
        "complement": None,
        "city": "São Paulo",
        "state": "SP",
        "postal_code": "01310000",
    }


def test_an_invalid_document_never_reaches_the_provider(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """A wrong check digit is a form error, not a failed payment later.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        BillingData(**{**BILLING, "cpf_cnpj": "24971563793"})

    assert provider.requests == []


def test_a_masked_phone_is_normalized_before_it_travels(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The failure Asaas hides behind "phoneNumber deve ser informado".

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    assert BillingData(**BILLING).phone == "4738010919"
    assert provider.requests == []


# --- Durability of the intent --------------------------------------------------
# `get_db_session` closes without committing, so every service commits by itself.
# The two things that must outlive the request are the Asaas customer id and the
# `incomplete` row: Fase 5 matches the confirmation on that row, and a row that
# never landed is a customer who paid and stayed on free forever.


def test_a_provider_refusal_leaves_no_subscription_behind(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """A row that survived a failure would block the retry with a 409 forever.

    Args:
        provider: Fake Asaas provider, refusing the checkout.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    provider.status = 400

    with pytest.raises(HTTPException):
        _open(db_session, actor, plan)

    db_session.rollback()
    assert db_session.query(Subscription).count() == 0


def test_the_asaas_customer_survives_a_failed_checkout(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The provider kept that customer forever; so must we, or the retry forks it.

    Args:
        provider: Fake Asaas provider, refusing the checkout.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    provider.status = 400
    with pytest.raises(HTTPException):
        _open(db_session, actor, plan)

    user = db_session.get(User, actor.id)
    assert user.asaas_customer_id == "cus_1"


def test_a_retry_after_a_refusal_does_not_fork_the_customer(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """Two customers for one person split their payment history at the provider.

    Args:
        provider: Fake Asaas provider.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    provider.status = 400
    with pytest.raises(HTTPException):
        _open(db_session, actor, plan)

    provider.status = 200
    _open(db_session, actor, plan)

    assert len(provider.calls_to("/customers")) == 1


def test_a_provider_failure_becomes_a_safe_message_not_a_provider_trace(
    provider, db_session: Session, plan: Plan, actor: UserResponse
):
    """The user gets our words; the provider's error page never reaches them.

    Args:
        provider: Fake Asaas provider, refusing the checkout.
        db_session: Database session.
        plan: Active plan.
        actor: Authenticated user.
    """
    provider.status = 400

    with pytest.raises(HTTPException) as raised:
        _open(db_session, actor, plan)

    assert raised.value.status_code == 502
    assert "asaas" not in raised.value.detail.lower()
    assert "invalid_object" not in raised.value.detail
