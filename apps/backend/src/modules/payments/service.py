import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from src.core.asaas_client import AsaasClient, parse_asaas_date, parse_asaas_datetime
from src.core.config import get_settings
from src.core.logger import log
from src.modules.payments.models import Payment
from src.modules.payments.repository import PaymentRepository, WebhookEventRepository
from src.modules.subscriptions.models import Subscription
from src.modules.subscriptions.service import SubscriptionWebhookService

# Asaas event name -> the status stored in `payments.status`.
WEBHOOK_STATUS_MAP = {
    "PAYMENT_RECEIVED": "received",
    "PAYMENT_CONFIRMED": "confirmed",
    "PAYMENT_OVERDUE": "overdue",
    "PAYMENT_REFUNDED": "refunded",
    "PAYMENT_DELETED": "deleted",
}

# Events that prove money arrived: the only ones allowed to *create* a
# history row. The others report on a charge and may only update one.
_PAYMENT_SETTLED_EVENTS = frozenset({"PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"})
_PAYMENT_REPORTED_EVENTS = frozenset({"PAYMENT_REFUNDED", "PAYMENT_DELETED"})


class PaymentService:
    """Business logic for the billing history and for the Asaas webhook."""

    def __init__(self, repository: PaymentRepository) -> None:
        """Assembles the service with its repositories and the Asaas client.

        The webhook's three writers — the event ledger, the payment history
        and the subscription state machine — share one session on purpose:
        the dispatch commits them together or not at all.

        Args:
            repository: Data access for the payment history.
        """
        self.repository = repository
        self.asaas = AsaasClient()
        self.events = WebhookEventRepository(repository.session)
        self.subscriptions = SubscriptionWebhookService(repository.session, self.asaas)

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

    def get_billing_history(self, user_id: UUID) -> list[Payment]:
        """Lists the subscription charges of a user, newest paid month first.

        Args:
            user_id: Authenticated user.

        Returns:
            The user's subscription charges (legacy one-off rows excluded).
        """
        return self.repository.list_billing_history(user_id)

    async def process_event(
        self, event_data: dict, *, now: datetime | None = None
    ) -> str:
        """Applies one Asaas webhook event, exactly once (§17, P-18).

        Asaas delivers at-least-once and retries on non-2xx, so idempotency
        lives in `webhook_events`: the event id is the primary key, and the
        insert happens before anything else changes — a replay (or a
        concurrent duplicate) loses that race and is answered without
        touching state. The ledger row and the effect share one transaction:
        an event either lands with its change or not at all.

        Only the event id, its name and the outcome are logged — the payload
        carries the payer's personal data and never reaches the log.

        Args:
            event_data: Decoded webhook body, already authenticated by the
                router through `verify_webhook_token`.
            now: Frozen clock for the state machine, injected by tests.

        Returns:
            `"ok"` when at least one row changed, `"ignored"` otherwise — a
            guard that held, an event with no target, or a replay.

        Raises:
            Exception: Any unexpected failure rolls back and propagates so the
                router can answer 503; a false 200 would make Asaas stop
                retrying and drop the event.
        """
        if not isinstance(event_data, dict):
            log.warning("[payments] webhook com corpo não-objeto: ignorado")
            return "ignored"
        event_type = event_data.get("event")
        event_id = event_data.get("id")
        if (
            not isinstance(event_type, str)
            or not isinstance(event_id, str)
            or not event_id
            or len(event_id) > 100
        ):
            log.warning("[payments] webhook sem identificação válida: ignorado")
            return "ignored"

        session = self.repository.session
        if self.events.find(event_id) is not None:
            log.info("[payments] evento %s repetido: ignorado", event_id)
            return "ignored"
        try:
            self.events.add(event_id, event_type)
            session.flush()
        except IntegrityError:
            # A concurrent delivery of the same event is committing right now.
            session.rollback()
            log.info("[payments] evento %s entregue em paralelo: ignorado", event_id)
            return "ignored"

        instant = now if now is not None else datetime.now(UTC)
        try:
            changed = await self._dispatch(event_type, event_data, now=instant)
            session.commit()
        except Exception:
            session.rollback()
            raise
        outcome = "ok" if changed else "ignored"
        log.info("[payments] webhook %s (%s) => %s", event_id, event_type, outcome)
        return outcome

    async def _dispatch(self, event_type: str, payload: dict, *, now: datetime) -> bool:
        """Routes one event to its writer.

        `CHECKOUT_*` and `SUBSCRIPTION_*` belong to the subscription state
        machine; `PAYMENT_*` may record history, move the subscription, or
        fall back to a legacy one-off charge created before subscriptions
        existed. Every branch answers whether it changed a row.

        Args:
            event_type: Asaas event name.
            payload: Decoded webhook body.
            now: Frozen clock of the dispatch.

        Returns:
            True when at least one row changed.
        """
        if event_type.startswith("CHECKOUT_"):
            return await self.subscriptions.apply_checkout(event_type, payload, now=now)
        if event_type.startswith("SUBSCRIPTION_"):
            return self.subscriptions.apply_subscription(event_type, payload, now=now)
        if event_type not in WEBHOOK_STATUS_MAP:
            return False

        payment = payload.get("payment")
        payment = payment if isinstance(payment, dict) else {}
        subscription = self.subscriptions.find_for_payment(payment)
        if subscription is not None:
            changed = False
            if event_type in _PAYMENT_SETTLED_EVENTS:
                facts = _history_kwargs(
                    subscription, payment, WEBHOOK_STATUS_MAP[event_type], paid=True
                )
                if facts is not None:
                    changed |= self.repository.record_subscription_payment(
                        facts, may_create=True
                    )
            elif event_type in _PAYMENT_REPORTED_EVENTS:
                facts = _history_kwargs(
                    subscription, payment, WEBHOOK_STATUS_MAP[event_type], paid=False
                )
                if facts is not None:
                    changed |= self.repository.record_subscription_payment(
                        facts, may_create=False
                    )
            # `PAYMENT_OVERDUE` moves only the subscription: nothing was paid,
            # so there is no month to record.
            changed |= self.subscriptions.apply_payment(
                event_type, subscription, payment, now=now
            )
            return changed

        payment_id = payment.get("id") or payload.get("paymentId")
        if isinstance(payment_id, str) and payment_id:
            return self.repository.apply_asaas_status(
                payment_id, WEBHOOK_STATUS_MAP[event_type]
            )
        return False


def _history_kwargs(
    subscription: Subscription, payment: dict, status: str, *, paid: bool
) -> dict | None:
    """Validates a payment payload into the fields the history row requires.

    The `NOT NULL` columns of `payments` are never filled with guesses: a
    payload missing the amount, the billing method or a readable due date logs
    and skips the row instead of storing a lie — the subscription state still
    moves, it just does not invent a paid month.

    Args:
        subscription: Matched local row; the history row is its (and its
            user's) record of the charge.
        payment: The `payment` object of the payload.
        status: `payments.status` value from `WEBHOOK_STATUS_MAP`.
        paid: Whether the event proves money arrived. Only then does the
            payload's `datePayment` become `paid_at` — on a refund that stamp
            is money going *back*, and it must not rewrite the month.

    Returns:
        Column → value dict for `Payment`, or `None` when a required field is
        missing or malformed.
    """
    payment_id = payment.get("id")
    due = parse_asaas_date(payment.get("dueDate"))
    amount: float | None = None
    raw_amount = payment.get("value")
    if isinstance(raw_amount, (int, float, str)) and not isinstance(raw_amount, bool):
        try:
            amount = float(raw_amount)
        except ValueError:
            amount = None
    billing_type = payment.get("billingType")
    if (
        not isinstance(payment_id, str)
        or not payment_id
        or due is None
        or amount is None
        or not isinstance(billing_type, str)
        or not billing_type
    ):
        log.warning(
            "[payments] payload de pagamento incompleto para %s: histórico não gravado",
            subscription.id,
        )
        return None

    invoice_url = payment.get("invoiceUrl")
    customer = payment.get("customer")
    description = payment.get("description")
    return {
        "subscription_id": subscription.id,
        "user_id": subscription.user_id,
        "asaas_payment_id": payment_id,
        "status": status,
        "amount": amount,
        "payment_method": billing_type,
        "due_date": due.isoformat(),
        "cycle_month": due.strftime("%Y-%m"),
        "paid_at": parse_asaas_datetime(payment.get("datePayment")) if paid else None,
        "invoice_url": invoice_url if isinstance(invoice_url, str) else None,
        "asaas_customer_id": customer if isinstance(customer, str) else None,
        "description": description if isinstance(description, str) else None,
    }
