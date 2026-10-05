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


def test_create_subscription_sends_the_documented_contract(provider):
    """Asaas requires customer, billingType, value, nextDueDate and cycle.

    Anything missing is a 400 that the user sees as a failed checkout, and the
    recurring charge silently never happens.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(
        client.create_subscription(
            customer_id="cus_123",
            value=Decimal("27.90"),
            next_due_date=date(2026, 11, 10),
            cycle="monthly",
            credit_card_token="tok_abc",
            remote_ip="203.0.113.9",
            external_reference="11111111-2222-3333-4444-555555555555",
            description="Cafe com BPO - Mensal",
        )
    )

    request = provider.last
    assert request.method == "POST"
    assert str(request.url) == f"{PRODUCTION_URL}/subscriptions"
    assert request.headers["access_token"] == API_KEY
    assert provider.body() == {
        "customer": "cus_123",
        "billingType": "CREDIT_CARD",
        "value": 27.9,
        "nextDueDate": "2026-11-10",
        "cycle": "MONTHLY",
        "description": "Cafe com BPO - Mensal",
        "externalReference": "11111111-2222-3333-4444-555555555555",
        "creditCardToken": "tok_abc",
        "remoteIp": "203.0.113.9",
    }


@pytest.mark.parametrize(
    ("internal", "asaas"),
    [
        ("weekly", "WEEKLY"),
        ("biweekly", "BIWEEKLY"),
        ("monthly", "MONTHLY"),
        ("bimonthly", "BIMONTHLY"),
        ("quarterly", "QUARTERLY"),
        ("semiannually", "SEMIANNUALLY"),
        ("yearly", "YEARLY"),
    ],
)
def test_cycle_names_are_translated_to_the_provider_enum(provider, internal, asaas):
    """Our lowercase cycle vocabulary is translated to Asaas' uppercase enum.

    Args:
        provider: Fake Asaas provider recording the requests.
        internal: Cycle name as stored locally.
        asaas: Cycle name expected by Asaas.
    """
    client = AsaasClient()

    _run(
        client.create_subscription(
            customer_id="cus_123",
            value=Decimal("27.90"),
            next_due_date=date(2026, 11, 10),
            cycle=internal,
            credit_card_token="tok_abc",
            remote_ip="203.0.113.9",
        )
    )

    assert provider.body()["cycle"] == asaas


def test_unknown_cycle_is_refused_before_any_request(provider):
    """An unmapped cycle must not be sent to the provider as free text.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    with pytest.raises(ValueError, match="cycle"):
        _run(
            client.create_subscription(
                customer_id="cus_123",
                value=Decimal("27.90"),
                next_due_date=date(2026, 11, 10),
                cycle="fortnightly",
                credit_card_token="tok_abc",
                remote_ip="203.0.113.9",
            )
        )

    assert provider.requests == []


def test_create_subscription_refuses_to_send_raw_card_data(provider):
    """There is no parameter to pass a PAN: the token is the only way in.

    A signature that accepts `number`/`ccv` would let a future endpoint log or
    store them, which §17.5 of the business rules forbids.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    import inspect

    parameters = set(inspect.signature(AsaasClient.create_subscription).parameters)

    assert "number" not in parameters
    assert "ccv" not in parameters
    assert "credit_card_token" in parameters
    assert "remote_ip" in parameters
    assert provider.requests == []


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


def test_update_subscription_card_sends_only_the_token(provider):
    """`PUT /subscriptions/{id}/creditCard` accepts a token instead of the card.

    This is how a user changes the card on an active subscription without our
    server ever seeing the new PAN: the browser tokenizes and sends the token.

    Args:
        provider: Fake Asaas provider recording the requests.
    """
    client = AsaasClient()

    _run(
        client.update_subscription_card(
            subscription_id="sub_42",
            credit_card_token="tok_new",
            remote_ip="203.0.113.9",
        )
    )

    assert provider.last.method == "PUT"
    assert str(provider.last.url) == f"{PRODUCTION_URL}/subscriptions/sub_42/creditCard"
    body = provider.body()
    assert body == {"creditCardToken": "tok_new", "remoteIp": "203.0.113.9"}
    assert "number" not in body
    assert "ccv" not in body


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


def test_provider_error_never_reaches_the_caller_with_card_data(provider, caplog):
    """A rejected card must not echo the PAN, the token or the API key back.

    `raise_for_status` builds the message from the URL, which is fine; the body
    of an Asaas error can repeat what we sent, so it is never propagated.

    Args:
        provider: Fake Asaas provider recording the requests.
        caplog: pytest log capture fixture.
    """
    provider.status = 400
    provider.payload = {
        "errors": [
            {
                "code": "invalid_card",
                "description": "card 4111111111111111 token tok_abc rejected",
            }
        ]
    }
    client = AsaasClient()

    with pytest.raises(httpx.HTTPStatusError) as raised:
        _run(
            client.update_subscription_card(
                subscription_id="sub_42",
                credit_card_token="tok_abc",
                remote_ip="203.0.113.9",
            )
        )

    rendered = str(raised.value)
    assert "4111111111111111" not in rendered
    assert API_KEY not in rendered
    assert "card 4111" not in caplog.text


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
