"""Contract tests for the Asaas HTTP client (phase 2 of the payments plan).

The client talks to a payment provider, so a wrong field name is a silent money
bug: Asaas answers 200 with a subscription that charges the wrong amount, or a
charge that is never linked to the subscription that produced it. These tests
pin the wire contract against the documented API instead of against our
assumptions.

Two defects are locked here:

- `list_payments` passed the filter as the JSON **body** of a GET
  (`_request("GET", "/payments", params)` with a `json_data` parameter), so the
  `customer` filter never reached the query string: the provider answered with
  every customer's charges. `test_query_filters_never_travel_in_the_body` fails if
  that shape comes back.
- Card data reaches Asaas as a `creditCardToken` and nothing else. The PAN, CVV
  and expiry must never be part of a request we build
  (`test_card_requests_carry_only_the_token`).
"""

import json
from datetime import date
from decimal import Decimal

import httpx
import pytest

from src.core import asaas_client
from src.core import asaas_client as client_module
from src.core.asaas_client import AsaasClient
from src.core.config import get_settings

API_KEY = "asaas-api-key-for-tests"
PRODUCTION_URL = "https://api.asaas.com/api/v3"


@pytest.fixture
def provider(monkeypatch):
    """Serves fake Asaas responses and records the requests the client made.

    The transport is swapped at `httpx.AsyncClient`, so the URL, the method, the
    auth header and the body are all exercised as they would be in production
    while the test stays offline and deterministic.

    Args:
        monkeypatch: pytest monkeypatch fixture.

    Returns:
        A mutable object with the recorded `requests` and the response
        `status`/`payload` the fake provider answers with.
    """

    class Provider:
        def __init__(self) -> None:
            self.requests: list[httpx.Request] = []
            self.status = 200
            self.payload = {"id": "sub_1", "status": "ACTIVE"}

        @property
        def last(self) -> httpx.Request:
            """Returns the most recent recorded request."""
            assert self.requests, "the client made no request"
            return self.requests[-1]

        def body(self) -> dict:
            """Returns the JSON body of the most recent request."""
            assert self.last.content, "the request had no body"
            return json.loads(self.last.content)

    fake = Provider()

    def handler(request: httpx.Request) -> httpx.Response:
        fake.requests.append(request)
        return httpx.Response(fake.status, json=fake.payload)

    def factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        # The real class is captured before the patch: looking it up through the
        # module attribute would call the factory itself.
        return real_client_cls(*args, **kwargs)

    real_client_cls = httpx.AsyncClient
    monkeypatch.setenv("ASAAS_API_KEY", API_KEY)
    monkeypatch.setenv("ASAAS_BASE_URL", PRODUCTION_URL)
    monkeypatch.setenv("MODE", "test")
    get_settings.cache_clear()
    monkeypatch.setattr(client_module.httpx, "AsyncClient", factory)
    try:
        yield fake
    finally:
        get_settings.cache_clear()


@pytest.mark.parametrize(
    ("stored", "sent"),
    [
        ("WEEKLY", "WEEKLY"),
        ("BIWEEKLY", "BIWEEKLY"),
        ("MONTHLY", "MONTHLY"),
        ("BIMONTHLY", "BIMONTHLY"),
        ("QUARTERLY", "QUARTERLY"),
        ("SEMIANNUALLY", "SEMIANNUALLY"),
        ("YEARLY", "YEARLY"),
    ],
)
def test_the_stored_cycle_is_accepted_verbatim(provider, stored, sent):
    """`subscriptions.cycle` is stored the way Asaas names it: uppercase.

    The column, its server default and the migration seed all use `MONTHLY`, so a
    client that only understood `monthly` would raise `ValueError` the first time
    the checkout passed `subscription.cycle` through — one vocabulary, not two.

    Args:
        provider: Fake Asaas provider recording the requests.
        stored: Cycle name as stored in `subscriptions.cycle`.
        sent: Cycle name expected by Asaas.
    """
    client = AsaasClient()

    _run(
        client.create_subscription_checkout(
            customer_id="cus_123",
            item_name="Cafe com BPO - Mensal",
            item_description="Assinatura mensal",
            value=Decimal("27.90"),
            next_due_date=date(2026, 11, 10),
            cycle=stored,
            success_url="https://app.test/ok",
            cancel_url="https://app.test/cancel",
            expired_url="https://app.test/expired",
            external_reference="sub_42",
        )
    )

    assert provider.body()["subscription"]["cycle"] == sent


def test_the_default_cycle_column_matches_the_client_vocabulary():
    """The domain constant and the provider vocabulary cannot drift apart.

    Args:
        None: No fixture; this is a pure constant comparison.
    """
    from src.modules.subscriptions.models import SUBSCRIPTION_CYCLE_MONTHLY

    assert SUBSCRIPTION_CYCLE_MONTHLY in asaas_client.SUBSCRIPTION_CYCLES


def test_unknown_cycle_is_refused_before_any_request(provider):
    """An unmapped cycle must not be sent to the provider as free text.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    with pytest.raises(ValueError, match="cycle"):
        _run(
            client.create_subscription_checkout(
                customer_id="cus_123",
                item_name="Cafe com BPO - Mensal",
                item_description="Assinatura mensal",
                value=Decimal("27.90"),
                next_due_date=date(2026, 11, 10),
                cycle="FORTNIGHTLY",
                success_url="https://app.test/ok",
                cancel_url="https://app.test/cancel",
                expired_url="https://app.test/expired",
                external_reference="sub_42",
            )
        )

    assert provider.requests == []


def test_no_method_of_the_client_accepts_card_data(provider):
    """No signature anywhere in the client takes a PAN, a CVV or a card token.

    §17.2 moved the card to a page Asaas hosts, so the platform never receives
    one of these values: a method that asked for one could only be fed by
    inventing card data, and would put us back in SAQ D. Checked across the whole
    class rather than one method, so a new method cannot quietly reintroduce it.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    import inspect

    forbidden = {
        "credit_card_number",
        "credit_card_expiry",
        "credit_card_ccv",
        "credit_card_holder_name",
        "credit_card_token",
        "number",
        "ccv",
        "card_number",
    }
    offenders = {
        name: sorted(
            forbidden & set(inspect.signature(getattr(AsaasClient, name)).parameters)
        )
        for name in dir(AsaasClient)
        if not name.startswith("_")
        and callable(getattr(AsaasClient, name))
        and forbidden & set(inspect.signature(getattr(AsaasClient, name)).parameters)
    }

    assert offenders == {}


def test_get_subscription_reads_the_subscription(provider):
    """Reads the provider state so a status drift is observable.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    result = _run(client.get_subscription("sub_42"))

    assert provider.last.method == "GET"
    assert str(provider.last.url) == f"{PRODUCTION_URL}/subscriptions/sub_42"
    assert result["id"] == "sub_1"


def test_cancel_subscription_issues_a_delete_without_a_body(provider):
    """Cancellation must not invent fields: Asaas deletes the subscription.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(client.cancel_subscription("sub_42"))

    assert provider.last.method == "DELETE"
    assert str(provider.last.url) == f"{PRODUCTION_URL}/subscriptions/sub_42"
    assert not provider.last.content


def test_query_filters_never_travel_in_the_body(provider):
    """GET filters belong in the query string, or the provider ignores them.

    The old `list_payments` sent `{"customer": ..., "limit": ...}` as the body of
    a GET, so Asaas answered with every customer's charges — the caller believed
    it had filtered.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(client.list_subscription_payments("sub_42", limit=5, offset=10))

    request = provider.last
    assert request.method == "GET"
    assert not request.content, "a GET filter must not be sent as a JSON body"
    assert dict(request.url.params) == {"limit": "5", "offset": "10"}


def test_update_subscription_sends_only_the_changed_fields(provider):
    """`PUT /subscriptions/{id}` replaces the schedule, so only what changes goes.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(client.update_subscription("sub_42", next_due_date=date(2026, 12, 10)))

    assert provider.last.method == "PUT"
    assert str(provider.last.url) == f"{PRODUCTION_URL}/subscriptions/sub_42"
    assert provider.body() == {"nextDueDate": "2026-12-10"}


def test_provider_error_never_reaches_the_caller_with_the_body(provider, caplog):
    """A rejected request must not echo what we sent, nor the API key, back.

    `raise_for_status` builds the message from the URL, which is fine; the body
    of an Asaas error can repeat the request, so it is never propagated. This
    used to be pinned with a card number, back when §17.2 had the backend
    tokenizing; it is now pinned with the payer's document, which still travels
    in a subscription body and is the most sensitive thing we send.

    Args:
        provider: Fake Asaas provider recording the requests.
        caplog: pytest log capture fixture.
    """
    provider.status = 400
    provider.payload = {
        "errors": [
            {
                "code": "invalid_document",
                "description": "document 12345678909 for customer cus_7 rejected",
            }
        ]
    }
    client = AsaasClient()

    with pytest.raises(httpx.HTTPStatusError) as raised:
        _run(
            client.create_subscription_checkout(
                customer_id="cus_7",
                item_name="Cafe com BPO - Mensal",
                item_description="Assinatura mensal",
                value=Decimal("27.90"),
                cycle="MONTHLY",
                next_due_date=date(2026, 11, 10),
                success_url="https://app.test/ok",
                cancel_url="https://app.test/cancel",
                expired_url="https://app.test/expired",
                external_reference="12345678909",
            )
        )

    rendered = str(raised.value)
    assert "12345678909" not in rendered
    assert API_KEY not in rendered
    assert "document 12345678909" not in caplog.text


def test_sandbox_base_url_is_refused_in_production(monkeypatch):
    """Charging a real customer inside the sandbox is silent data/money loss."""
    monkeypatch.setenv("MODE", "production")
    monkeypatch.setenv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValueError, match="sandbox"):
            AsaasClient()
    finally:
        get_settings.cache_clear()


def test_missing_api_key_is_refused_in_production(monkeypatch):
    """Production without a key must break at boot, not at the first charge.

    The compose file was missing the Asaas variables entirely, so production
    booted with an empty key and every customer checkout failed with an opaque
    401 from the provider. The refusal has to happen while starting.
    """
    monkeypatch.setenv("MODE", "production")
    monkeypatch.setenv("ASAAS_API_KEY", "")
    monkeypatch.setenv("ASAAS_BASE_URL", "https://api.asaas.com/api/v3")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValueError, match="ASAAS_API_KEY"):
            AsaasClient()
    finally:
        get_settings.cache_clear()


def test_a_missing_api_key_is_tolerated_outside_production(monkeypatch):
    """Tests and local development run without a provider key on purpose.

    Refusing to build the client everywhere would make the whole suite depend on
    a real credential; the loud refusal is scoped to production.
    """
    monkeypatch.setenv("MODE", "test")
    monkeypatch.setenv("ASAAS_API_KEY", "")
    get_settings.cache_clear()
    try:
        assert AsaasClient().api_key == ""
    finally:
        get_settings.cache_clear()


def _run(coroutine):
    """Runs a coroutine to completion.

    `pytest-asyncio` is not a dependency of this project, and the client is only
    ever called from async routers, so the tests drive it directly.

    Args:
        coroutine: The coroutine to run.

    Returns:
        Whatever the coroutine returned.
    """
    import asyncio

    return asyncio.run(coroutine)


# --- Hosted checkout (§17.2) ---------------------------------------------------
# The card never reaches our servers: the buyer is redirected to a page Asaas
# hosts, which keeps the platform in PCI DSS SAQ A instead of SAQ D. These tests
# pin the wire contract that makes that possible, and the three things Asaas
# rejects with a 400 that no offline guess would have found.


def test_create_checkout_sends_the_documented_contract(provider):
    """`POST /checkouts` opens a recurring session for an existing customer.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()
    provider.payload = {
        "id": "chk_1",
        "link": "https://www.asaas.com/checkoutSession/show/chk_1",
        "status": "ACTIVE",
    }

    result = _run(
        client.create_subscription_checkout(
            customer_id="cus_7",
            item_name="Cafe com BPO - Mensal",
            item_description="Assinatura mensal",
            value=Decimal("27.90"),
            cycle="MONTHLY",
            next_due_date=date(2026, 10, 20),
            success_url="https://app.test/painel/pagamentos?status=ok",
            cancel_url="https://app.test/painel/pagamentos?status=cancelado",
            expired_url="https://app.test/painel/pagamentos?status=expirado",
            external_reference="sub_42",
        )
    )

    assert provider.last.method == "POST"
    assert str(provider.last.url) == f"{PRODUCTION_URL}/checkouts"
    body = provider.body()
    # A recurring charge is the whole point, and Asaas only allows a card on it.
    assert body["chargeTypes"] == ["RECURRENT"]
    assert body["billingTypes"] == ["CREDIT_CARD"]
    assert body["customer"] == "cus_7"
    assert body["externalReference"] == "sub_42"
    assert body["subscription"] == {
        "cycle": "MONTHLY",
        "nextDueDate": "2026-10-20",
    }
    assert body["callback"]["successUrl"].endswith("status=ok")
    assert body["callback"]["cancelUrl"].endswith("status=cancelado")
    assert body["callback"]["expiredUrl"].endswith("status=expirado")
    # The item carries the price, so it must be a JSON number and not a string:
    # a quoted "27.90" is rejected as an invalid object.
    item = body["items"][0]
    assert item["quantity"] == 1
    assert item["value"] == 27.90
    assert isinstance(item["value"], float)
    assert item["name"] == "Cafe com BPO - Mensal"
    assert result["link"].endswith("chk_1")


def test_the_checkout_item_always_carries_an_image(provider):
    """`imageBase64` is required on every item and Asaas answers 400 without it.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(
        client.create_subscription_checkout(
            customer_id="cus_7",
            item_name="Cafe com BPO - Mensal",
            item_description="Assinatura mensal",
            value=Decimal("27.90"),
            cycle="MONTHLY",
            next_due_date=date(2026, 10, 20),
            success_url="https://app.test/ok",
            cancel_url="https://app.test/cancel",
            expired_url="https://app.test/expired",
            external_reference="sub_42",
        )
    )

    image = provider.body()["items"][0]["imageBase64"]
    assert image, "the item would be rejected by Asaas"
    assert provider.body()["items"][0]["description"] == "Assinatura mensal"


def test_the_checkout_never_carries_card_data(provider):
    """The whole point of the hosted checkout: no PAN reaches a request we build.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(
        client.create_subscription_checkout(
            customer_id="cus_7",
            item_name="Cafe com BPO - Mensal",
            item_description="Assinatura mensal",
            value=Decimal("27.90"),
            cycle="MONTHLY",
            next_due_date=date(2026, 10, 20),
            success_url="https://app.test/ok",
            cancel_url="https://app.test/cancel",
            expired_url="https://app.test/expired",
            external_reference="sub_42",
        )
    )

    serialized = provider.last.content.decode()
    for field in ("creditCard", "creditCardToken", "cardNumber", "ccv"):
        assert field not in serialized


def test_a_quote_in_the_price_would_break_the_checkout(provider):
    """Guards the decimal -> number conversion that `value` depends on.

    §17.1 stores the price as `NUMERIC(12,2)`, so it arrives as `Decimal("27.90")`.
    Serialized as a string the provider answers
    `{"code": "invalid_object"}`; observed in the sandbox on 2026-10-05.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(
        client.create_subscription_checkout(
            customer_id="cus_7",
            item_name="Cafe com BPO - Mensal",
            item_description="Assinatura mensal",
            value=Decimal("27.90"),
            cycle="MONTHLY",
            next_due_date=date(2026, 10, 20),
            success_url="https://app.test/ok",
            cancel_url="https://app.test/cancel",
            expired_url="https://app.test/expired",
            external_reference="sub_42",
        )
    )

    assert json.loads(provider.last.content)["items"][0]["value"] == 27.90


def test_cancel_checkout_addresses_the_session(provider):
    """Cancelling is `POST /checkouts/{id}/cancel`, and the payer is told.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()
    provider.payload = {"id": "chk_1", "status": "CANCELED"}

    result = _run(client.cancel_checkout("chk_1"))

    assert provider.last.method == "POST"
    assert str(provider.last.url) == f"{PRODUCTION_URL}/checkouts/chk_1/cancel"
    assert result["status"] == "CANCELED"


def test_replacing_the_card_needs_no_card_endpoint():
    """The client exposes no way to write a card, and that is deliberate.

    §17.2 replaced the card through another hosted checkout: `PUT
    /subscriptions/{id}/creditCard` wants the PAN again (back to SAQ D) or a token
    this platform never holds. A method named like the old card API reappearing
    here means the SAQ A decision was undone in code.

    Returns:
        None. Raises `AssertionError` when a card-writing method exists.
    """
    forbidden = {
        "tokenize_credit_card",
        "update_subscription_card",
        "list_credit_cards",
        "set_default_credit_card",
        "delete_credit_card",
    }

    assert forbidden.isdisjoint(dir(AsaasClient))
