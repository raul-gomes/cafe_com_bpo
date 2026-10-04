import secrets
from uuid import UUID

import httpx

from src.core.config import get_settings
from src.core.logger import log
from src.modules.payments.models import Payment
from src.modules.payments.repository import PaymentRepository
from src.modules.payments.schemas import CreateCustomerInput, CreatePaymentInput

SANDBOX_HOST = "sandbox.asaas.com"

# Asaas event name -> the status stored in `payments.status`.
WEBHOOK_STATUS_MAP = {
    "PAYMENT_RECEIVED": "received",
    "PAYMENT_CONFIRMED": "confirmed",
    "PAYMENT_OVERDUE": "overdue",
    "PAYMENT_REFUNDED": "refunded",
    "PAYMENT_DELETED": "deleted",
}


class AsaasClient:
    """HTTP client for the Asaas API.

    The base URL is per environment (`ASAAS_BASE_URL`): the previous hardcoded
    sandbox URL meant production could never charge a real customer, and the
    mistake was invisible.
    """

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
                "ASAAS_BASE_URL aponta para o sandbox do Asaas com MODE=production: "
                "pagamento real não é processado. Configure a URL de produção."
            )

    async def _request(
        self, method: str, endpoint: str, json_data: dict | None = None
    ) -> dict:
        headers = {
            "Content-Type": "application/json",
            "access_token": self.api_key,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method,
                f"{self.base_url}{endpoint}",
                headers=headers,
                json=json_data,
            )
            response.raise_for_status()
            return response.json()

    async def create_customer(self, customer_data: CreateCustomerInput) -> dict:
        """Creates a customer in Asaas and returns the raw provider payload.

        Args:
            customer_data: Validated customer data from the request boundary.

        Returns:
            The Asaas customer payload (its `id` identifies the customer).
        """
        payload = {
            "name": customer_data.name,
            "email": customer_data.email,
        }
        if customer_data.cpf_cnpj:
            payload["cpfCnpj"] = customer_data.cpf_cnpj
        if customer_data.phone:
            payload["phone"] = customer_data.phone
        if customer_data.mobile_phone:
            payload["mobilePhone"] = customer_data.mobile_phone
        if customer_data.address:
            payload["address"] = customer_data.address
        if customer_data.address_number:
            payload["addressNumber"] = customer_data.address_number
        if customer_data.city:
            payload["city"] = customer_data.city
        if customer_data.state:
            payload["state"] = customer_data.state
        if customer_data.postal_code:
            payload["postalCode"] = customer_data.postal_code

        return await self._request("POST", "/customers", payload)

    async def get_customer(self, customer_id: str) -> dict:
        """Fetches a customer by provider id.

        Args:
            customer_id: Asaas customer id.

        Returns:
            The Asaas customer payload.
        """
        return await self._request("GET", f"/customers/{customer_id}")

    async def create_payment(
        self, customer_id: str, payment_data: CreatePaymentInput
    ) -> dict:
        """Creates a charge in Asaas and returns the raw provider payload.

        Args:
            customer_id: Asaas customer that pays the charge.
            payment_data: Validated charge data from the request boundary.

        Returns:
            The Asaas payment payload (its `id` identifies the charge).
        """
        payload = {
            "customer": customer_id,
            "billingType": payment_data.payment_method.upper(),
            "value": payment_data.amount,
            "dueDate": payment_data.due_date.isoformat(),
            "description": payment_data.description or "Pagamento Cafe com BPO",
        }
        if payment_data.success_url:
            payload["callback"] = {"successUrl": payment_data.success_url}

        return await self._request("POST", "/payments", payload)

    async def get_payment(self, payment_id: str) -> dict:
        """Fetches a charge by provider id.

        Args:
            payment_id: Asaas payment id.

        Returns:
            The Asaas payment payload.
        """
        return await self._request("GET", f"/payments/{payment_id}")

    async def get_payment_status(self, payment_id: str) -> dict:
        """Fetches the current status of a charge.

        Args:
            payment_id: Asaas payment id.

        Returns:
            The Asaas status payload.
        """
        return await self._request("GET", f"/payments/{payment_id}/status")

    async def list_payments(
        self, customer_id: str, limit: int = 20, offset: int = 0
    ) -> dict:
        """Lists the charges of a customer.

        Args:
            customer_id: Asaas customer id.
            limit: Maximum number of records.
            offset: Pagination offset.

        Returns:
            The Asaas list payload.
        """
        params = {"customer": customer_id, "limit": limit, "offset": offset}
        return await self._request("GET", "/payments", params)


class PaymentService:
    """Business logic for charges and for the Asaas webhook."""

    def __init__(self, repository: PaymentRepository) -> None:
        """Assembles the service with its repository and the Asaas client.

        Args:
            repository: Data access for payments and customer ids.
        """
        self.repository = repository
        self.asaas = AsaasClient()

    def verify_webhook_token(self, provided_token: str | None) -> bool:
        """Decides whether a webhook call comes from Asaas.

        Asaas authenticates webhooks with a shared token in the
        `asaas-access-token` header, not with a signature. The comparison is
        constant-time, and **an unconfigured token refuses everybody**: the
        previous behaviour (accept any POST) let anyone mark a payment as
        received by guessing a payment id.

        Args:
            provided_token: Value of the `asaas-access-token` header, if any.

        Returns:
            True only when the header matches the configured token.
        """
        expected = get_settings().asaas_webhook_token
        if not expected:
            log.warning(
                "[payments] ASAAS_WEBHOOK_TOKEN não configurado: webhook recusado"
            )
            return False
        if not provided_token:
            return False
        return secrets.compare_digest(provided_token, expected)

    def get_user_payments(self, user_id: UUID) -> list[Payment]:
        """Lists the payments of a user, newest first.

        Args:
            user_id: Authenticated user.

        Returns:
            The user's payments.
        """
        return self.repository.get_by_user(user_id)

    def get_payment(self, payment_id: UUID, user_id: UUID) -> Payment | None:
        """Returns one of the user's payments, scoped by owner.

        Args:
            payment_id: Payment id.
            user_id: Authenticated user.

        Returns:
            The payment, or `None` when it is not the user's.
        """
        return self.repository.get_by_id(payment_id, user_id)

    async def create_customer_for_user(
        self, user_id: UUID, customer_data: CreateCustomerInput
    ) -> dict:
        """Returns the user's Asaas customer, creating it on first use.

        Args:
            user_id: Authenticated user.
            customer_data: Validated customer data.

        Returns:
            The Asaas customer payload.
        """
        existing = self.repository.get_customer_by_user(user_id)
        if existing:
            return await self.asaas.get_customer(existing.asaas_customer_id)

        asaas_customer = await self.asaas.create_customer(customer_data)
        self.repository.save_customer_id(user_id, asaas_customer["id"])
        log.info(
            f"💳 Cliente Asaas criado para usuário {user_id}: {asaas_customer['id']}"
        )
        return asaas_customer

    async def create_payment(
        self,
        user_id: UUID,
        payment_data: CreatePaymentInput,
        customer_info: CreateCustomerInput,
    ) -> Payment:
        """Creates a charge in Asaas and records it as pending.

        Args:
            user_id: Authenticated user paying.
            payment_data: Validated charge data.
            customer_info: Customer data used when the user has no Asaas id yet.

        Returns:
            The stored `Payment` in `pending` status.
        """
        customer = self.repository.get_customer_by_user(user_id)
        if not customer:
            asaas_customer = await self.asaas.create_customer(customer_info)
            customer_id = asaas_customer["id"]
        else:
            customer_id = customer.asaas_customer_id

        asaas_payment = await self.asaas.create_payment(customer_id, payment_data)

        payment = self.repository.create_payment(
            user_id=user_id,
            amount=payment_data.amount,
            description=payment_data.description,
            payment_method=payment_data.payment_method,
            due_date=payment_data.due_date.isoformat(),
            asaas_customer_id=customer_id,
            asaas_payment_id=asaas_payment["id"],
            success_url=payment_data.success_url,
            error_url=payment_data.error_url,
        )

        log.info(
            f"💳 Pagamento criado: {payment.id} | Asaas: {asaas_payment['id']} | Valor: R$ {payment_data.amount}"
        )

        return payment

    def process_webhook(self, event_data: dict) -> Payment | None:
        """Applies an Asaas event to the matching payment.

        Only the event name and the ids are ever logged — the payload carries the
        payer's name, document and e-mail, and that is third-party personal data.

        The Asaas retry policy resends the same event, so the event id is kept in
        `webhook_data`: a replay returns the payment untouched instead of
        rewriting the stored payload.

        Args:
            event_data: Decoded webhook payload, already authenticated by the
                router through `verify_webhook_token`.

        Returns:
            The updated payment, or `None` when the event is not one we handle or
            does not match a known payment.
        """
        event_type = event_data.get("event")
        if event_type not in WEBHOOK_STATUS_MAP:
            return None

        asaas_payment_id = event_data.get("payment", {}).get("id") or event_data.get(
            "paymentId"
        )
        if not asaas_payment_id:
            return None

        payment = self.repository.get_by_asaas_id(asaas_payment_id)
        if not payment:
            return None

        event_id = event_data.get("id")
        stored_event_id = (payment.webhook_data or {}).get("event_id")
        if event_id and stored_event_id == event_id:
            log.info(
                "[payments] evento %s repetido para %s: ignorado", event_id, payment.id
            )
            return payment

        new_status = WEBHOOK_STATUS_MAP[event_type]
        stored_payload = dict(event_data)
        if event_id:
            stored_payload["event_id"] = event_id

        self.repository.update_status(payment.id, new_status, stored_payload)
        log.info(f"[payments] webhook processado: {payment.id} | {event_type}")

        return payment
