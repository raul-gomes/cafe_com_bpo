"""HTTP client for the Asaas payment API.

The client lives in `core` and not in the payments module because Asaas is a
core provider: subscriptions (the launch beta, the paid plan), the hosted checkout
that closes them and every charge created by a recurring cycle go through it.

Four rules shape this file:

- **The base URL is per environment** (`ASAAS_BASE_URL`). A hardcoded sandbox URL
  meant production could never charge a real customer, and the mistake was
  invisible until a customer's money moved in the wrong place.
- **The card never crosses this module.** §17.2 sends the buyer to a checkout page
  Asaas hosts, so no method accepts a number, a CVV or an expiry. The tokenization
  methods this file used to carry are gone with the decision: writing one back
  would put the platform in PCI DSS SAQ D, and `test_replacing_the_card_needs_no_
  card_endpoint` fails if a method named like the old card API comes back.
- **Request and response bodies are never logged.** A charge body carries the
  payer's name and document; a session link is a credential of its own.
- **The subscription is only created by a paid checkout.** Nothing here treats a
  session as an active subscription — `CHECKOUT_PAID` is what confirms it.
"""

from datetime import UTC, date, datetime
from decimal import Decimal

import httpx

from src.core.config import get_settings
from src.core.deadline import BUSINESS_TZ
from src.core.logger import log

SANDBOX_HOST = "sandbox.asaas.com"

# Asaas requires an image on every checkout item and answers 400 without one.
# A 1x1 transparent PNG is the honest minimum: the item is our plan, not a
# product photo, and shipping a real logo would mean a binary asset in the image
# build for something the payer never looks at. `allow_insecure_images` is not
# enabled on the account, so the payload must be a valid image.
_CHECKOUT_ITEM_IMAGE_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8"
    "/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)

# The recurring cycles Asaas accepts. This is the single vocabulary used inside
# the platform too: `subscriptions.cycle` is stored exactly as the provider names
# it, so the checkout passes `subscription.cycle` through without a translation
# that two vocabularies could disagree about.
SUBSCRIPTION_CYCLES = frozenset(
    {
        "WEEKLY",
        "BIWEEKLY",
        "MONTHLY",
        "BIMONTHLY",
        "QUARTERLY",
        "SEMIANNUALLY",
        "YEARLY",
    }
)

# How a charge is billed -> the provider's `billingType` enum. The platform
# charges the recurring plan by credit card; the other two are the legacy
# one-off charges still reachable from the old payment form.
BILLING_TYPE_MAP = {
    "PIX": "PIX",
    "BOLETO": "BOLETO",
    "CREDIT_CARD": "CREDIT_CARD",
}

DEFAULT_TIMEOUT_SECONDS = 30.0


class AsaasClient:
    """Thin, typed wrapper over the Asaas HTTP API."""

    def __init__(self) -> None:
        """Builds the client from settings and refuses to run misconfigured.

        Raises:
            ValueError: When `MODE=production` and the base URL points at the
                Asaas sandbox. Charging a real customer in the sandbox (or
                testing in production) is silent money/data loss, so the boot
                must break instead of the misconfiguration being ignored.
            ValueError: When `MODE=production` and the API key is missing. A
                production boot without `ASAAS_API_KEY` used to succeed and
                only fail at the first checkout, as an opaque 401 from the
                provider — the customer sees an error and nobody knows why.
        """
        # `get_settings()` is read per call (it is lru_cached): a module-level
        # snapshot would freeze the first configuration seen by the process.
        current = get_settings()
        self.api_key = current.asaas_api_key or ""
        self.base_url = current.asaas_base_url
        if current.mode == "production" and SANDBOX_HOST in self.base_url:
            raise ValueError(
                "ASAAS_BASE_URL points at the Asaas sandbox while MODE=production: "
                "real payments would never be processed. Configure the production URL."
            )
        if current.mode == "production" and not self.api_key.strip():
            raise ValueError(
                "ASAAS_API_KEY is empty while MODE=production: every checkout would "
                "be refused by the provider. Configure the Asaas access token."
            )

    async def _request(
        self,
        method: str,
        endpoint: str,
        json_data: dict | None = None,
        query: dict | None = None,
    ) -> dict:
        """Performs one authenticated call and returns the decoded payload.

        `query` exists because Asaas filters through the URL: passing filters as
        the JSON body of a GET made the provider answer with *every* record,
        which reads as a filtered list on our side.

        Args:
            method: HTTP verb.
            endpoint: Path relative to the configured base URL.
            json_data: Body to send, or `None` for GET/DELETE.
            query: Query string filters, or `None`.

        Returns:
            The decoded provider payload.

        Raises:
            httpx.HTTPStatusError: When the provider rejects the call. The
                message carries only the URL and the status; the response body
                (which can repeat what we sent) is never attached.
        """
        headers = {
            "Content-Type": "application/json",
            "access_token": self.api_key,
        }
        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SECONDS) as client:
            response = await client.request(
                method,
                url,
                headers=headers,
                json=json_data,
                params=query,
            )
        if response.is_error:
            # Only the status and the path: the body may quote the card, the
            # token or the payer's document back at us.
            log.warning(
                "[asaas] %s %s respondeu %s", method, endpoint, response.status_code
            )
        response.raise_for_status()
        return response.json()

    async def create_customer(
        self,
        *,
        name: str,
        email: str,
        cpf_cnpj: str | None = None,
        phone: str | None = None,
        mobile_phone: str | None = None,
        address: str | None = None,
        address_number: str | None = None,
        complement: str | None = None,
        city: str | None = None,
        state: str | None = None,
        postal_code: str | None = None,
    ) -> dict:
        """Creates a customer in Asaas and returns the raw provider payload.

        Args:
            name: Customer name.
            email: Customer e-mail.
            cpf_cnpj: Document, when known.
            phone: Landline with area code.
            mobile_phone: Mobile with area code.
            address: Street.
            address_number: Street number.
            complement: Apartment, block, floor — optional.
            city: City.
            state: State.
            postal_code: Postal code.

        Returns:
            The Asaas customer payload (its `id` identifies the customer).
        """
        payload = {
            "name": name,
            "email": email,
            "cpfCnpj": cpf_cnpj,
            "phone": phone,
            "mobilePhone": mobile_phone,
            "address": address,
            "addressNumber": address_number,
            "complement": complement,
            "city": city,
            "state": state,
            "postalCode": postal_code,
        }
        return await self._request("POST", "/customers", _without_nulls(payload))

    async def update_customer(
        self,
        *,
        customer_id: str,
        name: str,
        email: str,
        cpf_cnpj: str | None = None,
        phone: str | None = None,
        mobile_phone: str | None = None,
        address: str | None = None,
        address_number: str | None = None,
        complement: str | None = None,
        city: str | None = None,
        state: str | None = None,
        postal_code: str | None = None,
    ) -> dict:
        """Fills in or corrects the billing data Asaas holds for a customer.

        §17.8: the Checkout refuses to open until the customer carries a
        document, a phone and an address. That makes this method the rescue for a
        person whose first attempt failed — we already stored their customer id,
        and the provider keeps it forever, so without the update they would be
        permanently unable to subscribe.

        The same call carries the corrections when the user edits their address,
        which is why the write happens on every checkout rather than once.

        Args:
            customer_id: Asaas customer to update.
            name: Customer name.
            email: Customer e-mail.
            cpf_cnpj: Document, digits only.
            phone: Phone with area code, digits only — a masked one is refused.
            mobile_phone: Mobile with area code, when it differs.
            address: Street.
            address_number: Street number.
            city: City name; Asaas accepts the name, no IBGE code needed.
            state: Two-letter state code.
            postal_code: Postal code.

        Returns:
            The Asaas customer payload after the update.
        """
        payload = {
            "name": name,
            "email": email,
            "cpfCnpj": cpf_cnpj,
            "phone": phone,
            "mobilePhone": mobile_phone,
            "address": address,
            "addressNumber": address_number,
            "complement": complement,
            "city": city,
            "state": state,
            "postalCode": postal_code,
        }
        return await self._request(
            "PUT", f"/customers/{customer_id}", _without_nulls(payload)
        )

    async def get_customer(self, customer_id: str) -> dict:
        """Fetches a customer by provider id.

        Args:
            customer_id: Asaas customer id.

        Returns:
            The Asaas customer payload.
        """
        return await self._request("GET", f"/customers/{customer_id}")

    async def create_payment(
        self,
        *,
        customer_id: str,
        amount: float,
        payment_method: str,
        due_date: date,
        description: str | None = None,
        success_url: str | None = None,
    ) -> dict:
        """Creates a one-off charge in Asaas and returns the raw payload.

        Args:
            customer_id: Asaas customer that pays the charge.
            amount: Charge value in reais.
            payment_method: `PIX`, `BOLETO` or `CREDIT_CARD`.
            due_date: Due date of the charge.
            description: Description shown to the payer.
            success_url: Redirect target after payment.

        Returns:
            The Asaas payment payload (its `id` identifies the charge).

        Raises:
            ValueError: When the billing method has no provider equivalent.
        """
        billing_type = BILLING_TYPE_MAP.get(payment_method.upper())
        if billing_type is None:
            raise ValueError(f"unsupported billing method: {payment_method!r}")
        payload: dict = {
            "customer": customer_id,
            "billingType": billing_type,
            "value": float(amount),
            "dueDate": due_date.isoformat(),
            "description": description or "Pagamento Cafe com BPO",
        }
        if success_url:
            payload["callback"] = {"successUrl": success_url}
        return await self._request("POST", "/payments", payload)

    async def get_payment(self, payment_id: str) -> dict:
        """Fetches a charge by provider id.

        Args:
            payment_id: Asaas payment id.

        Returns:
            The Asaas payment payload.
        """
        return await self._request("GET", f"/payments/{payment_id}")

    async def get_subscription(self, subscription_id: str) -> dict:
        """Fetches a subscription by provider id.

        Args:
            subscription_id: Asaas subscription id.

        Returns:
            The Asaas subscription payload.
        """
        return await self._request("GET", f"/subscriptions/{subscription_id}")

    async def update_subscription(
        self,
        subscription_id: str,
        *,
        value: Decimal | None = None,
        next_due_date: date | None = None,
        cycle: str | None = None,
        end_date: date | None = None,
        description: str | None = None,
    ) -> dict:
        """Updates the schedule of an existing subscription.

        Only the arguments given are sent: Asaas replaces the recurring
        configuration, so an omitted field would silently reset the price.

        Args:
            subscription_id: Asaas subscription id.
            value: New monthly value in reais.
            next_due_date: New due date of the next charge.
            cycle: Cycle name, which must be one of `SUBSCRIPTION_CYCLES`.
            end_date: Date after which no charge is generated.
            description: New description.

        Returns:
            The updated Asaas subscription payload.

        Raises:
            ValueError: When `cycle` has no provider equivalent.
        """
        payload = _without_nulls(
            {
                "value": None if value is None else float(value),
                "nextDueDate": None
                if next_due_date is None
                else next_due_date.isoformat(),
                "endDate": None if end_date is None else end_date.isoformat(),
                "description": description,
            }
        )
        if cycle is not None:
            if cycle not in SUBSCRIPTION_CYCLES:
                raise ValueError(f"unsupported subscription cycle: {cycle!r}")
            payload["cycle"] = cycle
        return await self._request("PUT", f"/subscriptions/{subscription_id}", payload)

    async def cancel_subscription(self, subscription_id: str) -> dict:
        """Cancels a subscription so Asaas stops generating charges.

        Cancellation does not refund the current cycle: the user keeps what was
        paid until the period ends, which is the promise in §17.6.

        Args:
            subscription_id: Asaas subscription id.

        Returns:
            The Asaas subscription payload as it looks after the removal.
        """
        return await self._request("DELETE", f"/subscriptions/{subscription_id}")

    async def create_subscription_checkout(
        self,
        *,
        customer_id: str,
        item_name: str,
        item_description: str,
        value: Decimal,
        cycle: str,
        next_due_date: date,
        success_url: str,
        cancel_url: str,
        expired_url: str,
        external_reference: str,
        minutes_to_expire: int = 60,
    ) -> dict:
        """Opens a hosted checkout where the buyer signs up a subscription.

        The buyer is redirected to a page Asaas hosts and the card is typed
        there, so no PAN, CVV or token ever reaches this platform — that is what
        keeps us in PCI DSS SAQ A. Creating the session does **not** confirm a
        payment: the subscription only exists after `CHECKOUT_PAID`.

        The shape below was verified against the sandbox on 2026-10-05. Three
        details are not guessable and each one costs a 400 if wrong: a recurring
        charge accepts **only** `CREDIT_CARD` (Pix is rejected even though the
        documentation lists it), `imageBase64` is **required** on every item, and
        `value` must be a JSON number — a quoted decimal is an `invalid_object`.

        Args:
            customer_id: Asaas customer, reused so the buyer keeps one identity.
            item_name: Plan name shown on the Asaas page (max 30 chars).
            item_description: Line under the name (max 150 chars).
            value: Price in reais, straight from `plans.price`.
            cycle: Billing cycle, e.g. `MONTHLY`.
            next_due_date: First charge date, which the Beta rules fix.
            success_url: Where Asaas sends the buyer after paying.
            cancel_url: Where Asaas sends the buyer who gives up.
            expired_url: Where Asaas sends the buyer after the session lapses.
            external_reference: Our subscription id, so the webhook can match it.
            minutes_to_expire: Lifetime of the session (10..1440).

        Raises:
            ValueError: When `cycle` has no provider equivalent.

        Returns:
            The Asaas payload with the checkout `id`, `link` and `status`. The
            `link` is returned as-is and never rebuilt: sandbox and production
            use different hosts and sandbox carries an extra path segment.
        """
        if cycle not in SUBSCRIPTION_CYCLES:
            raise ValueError(f"unsupported subscription cycle: {cycle!r}")
        return await self._request(
            "POST",
            "/checkouts",
            {
                "customer": customer_id,
                "billingTypes": ["CREDIT_CARD"],
                "chargeTypes": ["RECURRENT"],
                "items": [
                    {
                        "name": item_name,
                        "description": item_description,
                        "quantity": 1,
                        "value": float(value),
                        "imageBase64": _CHECKOUT_ITEM_IMAGE_BASE64,
                    }
                ],
                "subscription": {
                    "cycle": cycle,
                    "nextDueDate": next_due_date.isoformat(),
                },
                "callback": {
                    "successUrl": success_url,
                    "cancelUrl": cancel_url,
                    "expiredUrl": expired_url,
                },
                "externalReference": external_reference,
                "minutesToExpire": minutes_to_expire,
            },
        )

    async def cancel_checkout(self, checkout_id: str) -> dict:
        """Closes a checkout nobody paid for.

        Used when the buyer abandons the journey in a way we learn about before
        the session expires. The state change arrives as `CHECKOUT_CANCELED`.

        Args:
            checkout_id: Checkout id as returned by `create_subscription_checkout`.

        Returns:
            The Asaas payload with the new `status`.
        """
        return await self._request("POST", f"/checkouts/{checkout_id}/cancel", {})

    async def list_subscription_payments(
        self, subscription_id: str, *, limit: int = 20, offset: int = 0
    ) -> dict:
        """Lists the charges a subscription has generated.

        Args:
            subscription_id: Asaas subscription id.
            limit: Maximum number of records.
            offset: Pagination offset.

        Returns:
            The Asaas list payload.
        """
        return await self._request(
            "GET",
            f"/subscriptions/{subscription_id}/payments",
            query={"limit": limit, "offset": offset},
        )

    async def list_subscriptions(
        self, *, customer: str, limit: int = 100, offset: int = 0
    ) -> dict:
        """Lists the subscriptions of one customer.

        Used by the webhook enrichment of `CHECKOUT_PAID`: the checkout event
        carries no subscription id, so the only way to learn it is to ask the
        provider for this customer's subscriptions and match on
        `externalReference`. The `customer` filter travels in the query string —
        a filter in the body of a GET is dropped by the provider, which would
        answer with the whole account's subscriptions.

        Args:
            customer: Asaas customer whose subscriptions are listed.
            limit: Maximum number of records.
            offset: Pagination offset.

        Returns:
            The Asaas list payload (`{"object": "list", "data": [...]}`).
        """
        return await self._request(
            "GET",
            "/subscriptions",
            query={"customer": customer, "limit": limit, "offset": offset},
        )


def parse_asaas_date(value: object) -> date | None:
    """Extracts the calendar date from a provider date field.

    Asaas sends due dates as `YYYY-MM-DD` but stamps instants with a time and
    an offset on the same field name (`nextDueDate` in a `CHECKOUT_*` payload).
    A due date is a business day, so the date part is taken as written — the
    stamp's time zone games must not move a charge to the neighbouring day.

    Args:
        value: Raw field from a provider payload.

    Returns:
        The date, or `None` when the field is absent or malformed (logged —
        a malformed due date silently dropping the period is the kind of bug
        that only shows up as an access loss a month later).
    """
    if not value:
        return None
    if not isinstance(value, str) or len(value) < 10:
        log.warning("[asaas] data de vencimento malformada recebida do provedor")
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        log.warning("[asaas] data de vencimento malformada recebida do provedor")
        return None


def parse_asaas_datetime(value: object) -> datetime | None:
    """Parses a provider instant and normalizes it to UTC.

    Two shapes exist in the documented payloads: ISO 8601 with an offset
    (`2026-10-05T12:00:00-03:00`, also `+0000`) and the naive
    `YYYY-MM-DD HH:MM:SS` of `datePayment`, which Asaas stamps in the
    account's business timezone (America/Sao_Paulo). A naive value is
    therefore business time, never UTC — reading it as UTC puts every payment
    three hours in the past.

    Args:
        value: Raw field from a provider payload.

    Returns:
        The instant in UTC, or `None` when the field is absent or malformed.
    """
    if not value:
        return None
    if not isinstance(value, str):
        log.warning("[asaas] data-hora malformada recebida do provedor")
        return None
    text = value.strip().replace(" ", "T", 1)
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        log.warning("[asaas] data-hora malformada recebida do provedor")
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=BUSINESS_TZ)
    return parsed.astimezone(UTC)


def _without_nulls(payload: dict) -> dict:
    """Drops the keys whose value is `None`.

    Asaas treats an explicit `null` as "clear this field" on an update, so an
    absent value has to be absent from the body and not sent as `null`.

    Args:
        payload: Candidate request body.

    Returns:
        The body without `None` values.
    """
    return {key: value for key, value in payload.items() if value is not None}
