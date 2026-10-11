"""End-to-end suite against the real Asaas sandbox (phase 11 of the payments plan).

Runs only with `pytest -m integration` and a sandbox key in the environment
(`ASAAS_API_KEY`, `ASAAS_BASE_URL`). The default `pytest` run excludes this
folder (`addopts = -m "not integration"`), so the hermetic suite never touches
the network.

Scope
-----
The platform closes a subscription through the hosted checkout (§17.2), so the
two resources it creates at the provider are the *customer* and the *checkout
session*. Asaas has no sandbox endpoint that pays a checkout over the API (the
"confirm payment" sandbox operation acts on charges, and a checkout only turns
into a subscription after the payer finishes the hosted page, which needs a
browser), and the client deliberately has no method that sends card data (SAQ A).
The suite therefore covers, against the real sandbox:

- the customer lifecycle: create -> get -> update round-trip, including the
  provider's phonenumber validation (`update_customer` answered `invalid_phone`
  for an 11-digit landline in `phone`, observed on 2026-10-08);
- the checkout lifecycle: a `RECURRENT`/`CREDIT_CARD` session opens for an
  existing customer and can be canceled — the link carries the extra `000/`
  path segment and is returned as-is, never rebuilt;
- `list_subscriptions` honors the `customer` filter on the real API;
- subscription reads answer the documented 404 for an unknown id (GET, PUT,
  DELETE) while `list_subscription_payments` surpises with 200 and an empty
  list — pinned here so the handler does not depend on an exception.

Price propagation and the webhook state machine stay covered offline by
`tests/test_price_propagation.py` and `tests/test_asaas_client.py`. Walking an
ACTIVE subscription (live `update_subscription`/`cancel_subscription`) needs a
subscribed sandbox customer, which can only be produced by paying the hosted
page by hand — logged as P-23 in `docs/pendencias.md`.
"""

import asyncio
from datetime import date
from decimal import Decimal

import httpx
import pytest

from src.core.asaas_client import AsaasClient
from src.core.config import get_settings

pytestmark = pytest.mark.integration

# Fixed far-future due date: Asaas rejects a date in the past and a fixed value
# keeps the test deterministic (no wall-clock arithmetic, §3).
NEXT_DUE_DATE = date(2030, 1, 15)

# Clearly-fictional payer, as the sandbox documentation recommends. The CPF is
# the same fictional one the offline contract tests use.
TEST_PAYER = {
    "name": "INTEGRATION TEST CAFE COM BPO",
    "email": "asaas-integration@cafecobpo.com.br",
    "cpf_cnpj": "24971563792",
    "phone": "4738010919",
    "mobile_phone": "47999000001",
    "address": "Av. Paulista",
    "address_number": "150",
    "complement": "Cj 101",
    "city": "Sao Paulo",
    "state": "SP",
    "postal_code": "01310-000",
}

# A second valid landline: Asaas refuses an 11-digit number in `phone`
# (`invalid_phone`) — this is the value the update asserts landed.
UPDATED_PHONE = "4738010920"


@pytest.fixture(scope="module")
def client() -> AsaasClient:
    """Builds the real HTTP client, skipping when the sandbox is not configured.

    Refuses to run pointed at production: this suite creates customer records
    and checkout sessions at the provider (fictional, but real artifacts), so
    they must never land in the production account — fail loudly instead of
    silently creating junk where money moves (§1).
    """
    get_settings.cache_clear()
    current = get_settings()
    if not current.asaas_api_key:
        pytest.skip("ASAAS_API_KEY not configured: run with the sandbox key")
    built = AsaasClient()
    if "sandbox" not in built.base_url:
        pytest.skip(
            "ASAAS_BASE_URL does not point at the sandbox: this suite creates "
            "real provider artifacts and must not touch production"
        )
    return built


def _run(coroutine):
    """Runs a provider coroutine to completion without pytest-asyncio.

    Args:
        coroutine: The coroutine to await.

    Returns:
        Whatever the coroutine returned.
    """

    return asyncio.run(coroutine)


class TestCustomerLifecycle:
    """The customer is the identity the checkout reuses (§17.8)."""

    def test_create_get_update_round_trip(self, client):
        """A customer is stored, read back verbatim and can be corrected.

        Args:
            client: Real sandbox HTTP client.
        """
        created = _run(client.create_customer(**TEST_PAYER))
        customer_id = created["id"]
        assert created["cpfCnpj"] == TEST_PAYER["cpf_cnpj"]
        assert created["email"] == TEST_PAYER["email"]

        fetched = _run(client.get_customer(customer_id))
        assert fetched["id"] == customer_id
        assert fetched["name"] == TEST_PAYER["name"]

        update_payload = {k: v for k, v in TEST_PAYER.items() if k != "phone"}
        _run(
            client.update_customer(
                customer_id=customer_id, phone=UPDATED_PHONE, **update_payload
            )
        )
        after = _run(client.get_customer(customer_id))
        assert after["phone"] == UPDATED_PHONE


class TestCheckoutSession:
    """The hosted session (§17.2) opens for an existing customer and closes."""

    def test_session_opens_and_cancels_for_an_existing_customer(self, client):
        """A recurring card session is created and canceling reaches the provider.

        Args:
            client: Real sandbox HTTP client.
        """
        customer = _run(client.create_customer(**TEST_PAYER))
        session = _run(
            client.create_subscription_checkout(
                customer_id=customer["id"],
                item_name="Cafe com BPO - Mensal",
                item_description="Assinatura mensal - teste de integracao",
                value=Decimal("27.90"),
                cycle="MONTHLY",
                next_due_date=NEXT_DUE_DATE,
                success_url="https://cafecobpo.app/painel/pagamentos?status=ok",
                cancel_url="https://cafecobpo.app/painel/pagamentos?status=cancelado",
                expired_url="https://cafecobpo.app/painel/pagamentos?status=expirado",
                external_reference="it-2026-cafe",
            )
        )
        assert session["status"] == "ACTIVE"
        assert session["billingTypes"] == ["CREDIT_CARD"]
        assert session["chargeTypes"] == ["RECURRENT"]
        assert session["externalReference"] == "it-2026-cafe"
        assert session["link"].startswith("https://sandbox.asaas.com/")
        # The provider echoes the due date with a time zone; the date part must
        # come back unchanged so the charge is not moved to a neighbouring day.
        assert session["subscription"]["nextDueDate"].startswith(
            NEXT_DUE_DATE.isoformat()
        )

        canceled = _run(client.cancel_checkout(session["id"]))
        assert canceled["status"] == "CANCELED"


class TestSubscriptionSurface:
    """The subscription endpoints the webhook and the reconciliation use."""

    def test_list_subscriptions_is_scoped_to_the_customer(self, client):
        """The `customer` filter travels in the URL and the answer is scoped.

        A fresh customer has no subscription, so the important assertion is the
        contract: any record returned must belong to that customer. If the
        filter silently fell off the query string (the old body-of-a-GET bug),
        foreign subscriptions would show up here.

        Args:
            client: Real sandbox HTTP client.
        """
        customer = _run(client.create_customer(**TEST_PAYER))
        listing = _run(client.list_subscriptions(customer=customer["id"], limit=5))
        assert listing["object"] == "list"
        for item in listing["data"]:
            assert item["customer"] == customer["id"]

    def test_unknown_subscription_detail_answers_404(self, client):
        """GET on a missing subscription raises the documented 404.

        Args:
            client: Real sandbox HTTP client.
        """
        with pytest.raises(httpx.HTTPStatusError) as raised:
            _run(client.get_subscription("sub_9999999999999999"))
        assert raised.value.response.status_code == 404

    def test_unknown_subscription_update_answers_404(self, client):
        """PUT on a missing subscription raises the documented 404.

        Args:
            client: Real sandbox HTTP client.
        """
        with pytest.raises(httpx.HTTPStatusError) as raised:
            _run(
                client.update_subscription(
                    "sub_9999999999999999", value=Decimal("9.90")
                )
            )
        assert raised.value.response.status_code == 404

    def test_unknown_subscription_cancel_answers_404(self, client):
        """DELETE on a missing subscription raises the documented 404.

        Args:
            client: Real sandbox HTTP client.
        """
        with pytest.raises(httpx.HTTPStatusError) as raised:
            _run(client.cancel_subscription("sub_9999999999999999"))
        assert raised.value.response.status_code == 404

    def test_unknown_subscription_payment_list_is_an_empty_list(self, client):
        """Charges of a missing subscription come back as 200 + an empty list.

        Observed on 2026-10-08: unlike the detail endpoints, this one does not
        raise. The history handler therefore cannot rely on an exception to
        mean "nobody there".

        Args:
            client: Real sandbox HTTP client.
        """
        listing = _run(
            client.list_subscription_payments("sub_9999999999999999", limit=5)
        )
        assert listing["data"] == []
        assert listing["totalCount"] == 0
