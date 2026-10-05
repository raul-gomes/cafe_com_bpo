"""HTTP client for the Asaas payment API.

The client lives in `core` and not in the payments module because Asaas is a
core provider: subscriptions (the launch beta, the paid plan), card handling and
every charge created by a recurring cycle go through it.

Three rules shape this file:

- **The base URL is per environment** (`ASAAS_BASE_URL`). A hardcoded sandbox URL
  meant production could never charge a real customer, and the mistake was
  invisible until a customer's money moved in the wrong place.
- **Card data is never sent as data.** Only a `creditCardToken` produced by the
  provider's tokenization crosses this module. No method accepts a number, a CVV
  or an expiry, so no future caller can log or store them by accident.
- **Request and response bodies are never logged.** A charge body carries the
  payer's name and document; a card token is a credential.
"""

from datetime import date
from decimal import Decimal

import httpx

from src.core.config import get_settings
from src.core.logger import log

SANDBOX_HOST = "sandbox.asaas.com"

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
        """Builds the client from settings and refuses a sandbox in production.

        Raises:
            ValueError: When `MODE=production` and the base URL points at the
                Asaas sandbox. Charging a real customer in the sandbox (or
                testing in production) is silent money/data loss, so the boot
                must break instead of the misconfiguration being ignored.
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
            "city": city,
            "state": state,
            "postalCode": postal_code,
        }
        return await self._request("POST", "/customers", _without_nulls(payload))

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

    async def create_subscription(
        self,
        *,
        customer_id: str,
        value: Decimal,
        next_due_date: date,
        cycle: str,
        credit_card_token: str,
        remote_ip: str,
        external_reference: str | None = None,
        description: str | None = None,
    ) -> dict:
        """Creates a recurring subscription charged to a tokenized card.

        The recurring plan is billed by credit card because it is the only
        billing type Asaas supports for a subscription with an automatic
        renewal, and because the platform promises a card on file.

        Args:
            customer_id: Asaas customer that pays the subscription.
            value: Monthly value in reais, as stored in `plans.price`.
            next_due_date: Due date of the first charge.
            cycle: Cycle name, which must be one of `SUBSCRIPTION_CYCLES`.
            credit_card_token: Token produced by the provider's tokenization.
            remote_ip: IP of the buyer, required by Asaas and never ours.
            external_reference: Our subscription id, echoed back by the provider
                and by the subscription webhooks.
            description: Description shown on the statements.

        Returns:
            The Asaas subscription payload.

        Raises:
            ValueError: When `cycle` has no provider equivalent.
        """
        if cycle not in SUBSCRIPTION_CYCLES:
            raise ValueError(f"unsupported subscription cycle: {cycle!r}")
        payload: dict = {
            "customer": customer_id,
            "billingType": "CREDIT_CARD",
            "value": float(value),
            "nextDueDate": next_due_date.isoformat(),
            "cycle": cycle,
        }
        if description:
            payload["description"] = description
        if external_reference:
            payload["externalReference"] = external_reference
        payload["creditCardToken"] = credit_card_token
        payload["remoteIp"] = remote_ip
        return await self._request("POST", "/subscriptions", payload)

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

    async def update_subscription_card(
        self,
        *,
        subscription_id: str,
        credit_card_token: str,
        remote_ip: str,
    ) -> dict:
        """Replaces the card of an active subscription without charging it.

        `PUT /subscriptions/{id}/creditCard` also updates the pending charges of
        the recurrence, so a card fixed before the due date is enough.

        Args:
            subscription_id: Asaas subscription id.
            credit_card_token: Token produced by the provider's tokenization.
            remote_ip: IP of the buyer, required by Asaas and never ours.

        Returns:
            The updated Asaas subscription payload.
        """
        return await self._request(
            "PUT",
            f"/subscriptions/{subscription_id}/creditCard",
            {"creditCardToken": credit_card_token, "remoteIp": remote_ip},
        )

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
