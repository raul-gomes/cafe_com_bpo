import secrets
from uuid import UUID

from src.core.asaas_client import AsaasClient
from src.core.config import get_settings
from src.core.logger import log
from src.modules.payments.models import Payment
from src.modules.payments.repository import PaymentRepository
from src.modules.payments.schemas import CreateCustomerInput, CreatePaymentInput

# Asaas event name -> the status stored in `payments.status`.
WEBHOOK_STATUS_MAP = {
    "PAYMENT_RECEIVED": "received",
    "PAYMENT_CONFIRMED": "confirmed",
    "PAYMENT_OVERDUE": "overdue",
    "PAYMENT_REFUNDED": "refunded",
    "PAYMENT_DELETED": "deleted",
}


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

        asaas_customer = await self.asaas.create_customer(
            **_customer_payload(customer_data)
        )
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

        asaas_payment = await self.asaas.create_payment(
            customer_id=customer_id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            due_date=payment_data.due_date,
            description=payment_data.description,
            success_url=payment_data.success_url,
        )

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


def _customer_payload(customer_data: CreateCustomerInput) -> dict:
    """Unpacks the request schema into the client keywords.

    The client lives in `core` and takes plain values: a provider adapter that
    imports a module's boundary schema makes `core` depend on `modules`, and the
    dependency is then impossible to invert when a second module needs the same
    client.

    Args:
        customer_data: Validated customer data from the request boundary.

    Returns:
        Keyword arguments for `AsaasClient.create_customer`.
    """
    return customer_data.model_dump()
