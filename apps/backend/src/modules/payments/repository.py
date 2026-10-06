from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.payments.models import Payment, WebhookEvent


class UserCustomer:
    """The Asaas customer id already stored for a user."""

    def __init__(self, user_id: UUID, asaas_customer_id: str) -> None:
        """Binds a user to their Asaas customer id.

        Args:
            user_id: Owner of the Asaas customer.
            asaas_customer_id: Id assigned by Asaas.
        """
        self.user_id = user_id
        self.asaas_customer_id = asaas_customer_id


class PaymentRepository:
    """Data access for payments and stored Asaas customer ids."""

    def __init__(self, session: Session) -> None:
        """Binds the repository to a database session.

        Args:
            session: Session used for every query.
        """
        self.session = session

    def get_by_user(self, user_id: UUID) -> list[Payment]:
        """Lists a user's payments, newest first.

        Args:
            user_id: Owner of the payments.

        Returns:
            The user's payments.
        """
        return (
            self.session.query(Payment)
            .filter(Payment.user_id == user_id)
            .order_by(Payment.created_at.desc())
            .all()
        )

    def get_by_id(self, payment_id: UUID, user_id: UUID) -> Payment | None:
        """Returns a payment only when it belongs to `user_id`.

        Args:
            payment_id: Payment id.
            user_id: Authenticated user.

        Returns:
            The payment, or `None` when it belongs to someone else.
        """
        return (
            self.session.query(Payment)
            .filter(Payment.id == payment_id, Payment.user_id == user_id)
            .first()
        )

    def get_by_asaas_id(self, asaas_payment_id: str) -> Payment | None:
        """Finds a payment by its Asaas id (used by the webhook).

        Args:
            asaas_payment_id: Payment id assigned by Asaas.

        Returns:
            The matching payment, or `None`.
        """
        return (
            self.session.query(Payment)
            .filter(Payment.asaas_payment_id == asaas_payment_id)
            .first()
        )

    def get_customer_by_user(self, user_id: UUID) -> UserCustomer | None:
        """Returns the user's Asaas customer id, when already created.

        Args:
            user_id: Authenticated user.

        Returns:
            The stored customer, or `None` when the user has none yet.
        """
        from src.modules.auth.models import User

        user = (
            self.session.query(User)
            .filter(User.id == user_id, User.asaas_customer_id.isnot(None))
            .first()
        )
        if user and user.asaas_customer_id:
            return UserCustomer(
                user_id=user_id, asaas_customer_id=user.asaas_customer_id
            )
        return None

    def save_customer_id(self, user_id: UUID, asaas_customer_id: str) -> None:
        """Stores the Asaas customer id on the user row.

        Args:
            user_id: Authenticated user.
            asaas_customer_id: Id returned by Asaas.
        """
        from src.modules.auth.models import User

        user = self.session.query(User).filter(User.id == user_id).first()
        if user:
            user.asaas_customer_id = asaas_customer_id
            self.session.commit()

    def create_payment(
        self,
        user_id: UUID,
        amount: float,
        description: str | None,
        payment_method: str,
        due_date: str,
        asaas_customer_id: str,
        asaas_payment_id: str,
        success_url: str | None = None,
        error_url: str | None = None,
    ) -> Payment:
        """Persists a charge created in Asaas as `pending`.

        Args:
            user_id: Authenticated user paying.
            amount: Charge amount.
            description: Free-text description.
            payment_method: Billing type (PIX, BOLETO, CARD...).
            due_date: Due date in ISO format (YYYY-MM-DD).
            asaas_customer_id: Asaas customer that pays.
            asaas_payment_id: Asaas payment id.
            success_url: Redirect URL after payment.
            error_url: Redirect URL after failure.

        Returns:
            The stored payment.
        """
        payment = Payment(
            user_id=user_id,
            amount=amount,
            description=description,
            payment_method=payment_method,
            due_date=due_date,
            asaas_customer_id=asaas_customer_id,
            asaas_payment_id=asaas_payment_id,
            success_url=success_url,
            error_url=error_url,
        )
        self.session.add(payment)
        self.session.commit()
        self.session.refresh(payment)
        return payment

    def apply_asaas_status(self, asaas_payment_id: str, status: str) -> bool:
        """Moves a legacy one-off charge to the status the webhook reported.

        Legacy path: a charge created before subscriptions (`payments` rows
        without `subscription_id`) is still confirmed by the same webhook.

        Args:
            asaas_payment_id: Asaas payment id of the charge.
            status: New status from `WEBHOOK_STATUS_MAP`.

        Returns:
            True only when the row exists and its status actually changed —
            the webhook answers `ok` or `ignored` from this flag. The method
            mutates without committing: the webhook commits once per event.
        """
        payment = self.get_by_asaas_id(asaas_payment_id)
        if payment is None or payment.status == status:
            return False
        payment.status = status
        return True

    def record_subscription_payment(self, facts: dict, *, may_create: bool) -> bool:
        """Upserts the billing-history row of a charge, keyed by its Asaas id.

        One charge is one row: `PAYMENT_CONFIRMED` then `PAYMENT_RECEIVED` is a
        single paid month seen in two states, never two months. `may_create` is
        False for events that report on a charge without proving money arrived
        (`PAYMENT_REFUNDED`, `PAYMENT_DELETED`): without the original charge
        they must not fabricate a history row with a `paid_at` nobody paid.

        Args:
            facts: Validated row values keyed by column name, built from the
                payload by the service (already checked for the fields the
                `NOT NULL` columns require).
            may_create: Whether a missing row may be created.

        Returns:
            True when this call changed a row (created it, or altered at least
            one stored field). The webhook answers `ok` or `ignored` from it,
            and the method does not commit — the caller commits once per event.
        """
        payment = self.get_by_asaas_id(facts["asaas_payment_id"])
        if payment is None:
            if not may_create:
                return False
            self.session.add(Payment(**facts))
            return True

        changed = False
        if payment.status != facts["status"]:
            payment.status = facts["status"]
            changed = True
        # `paid_at` only travels for events that mean money arrived (the service
        # passes `None` otherwise): a refund's `datePayment` is the day the money
        # went back, and overwriting with it would rewrite history.
        if facts.get("paid_at") is not None and facts["paid_at"] != payment.paid_at:
            payment.paid_at = facts["paid_at"]
            changed = True
        if facts.get("invoice_url") and facts["invoice_url"] != payment.invoice_url:
            payment.invoice_url = facts["invoice_url"]
            changed = True
        if facts.get("cycle_month") and facts["cycle_month"] != payment.cycle_month:
            payment.cycle_month = facts["cycle_month"]
            changed = True
        if payment.subscription_id is None and facts.get("subscription_id"):
            payment.subscription_id = facts["subscription_id"]
            payment.user_id = facts["user_id"]
            changed = True
        return changed


class WebhookEventRepository:
    """Records every delivered webhook event for idempotency (P-18).

    The row is the dedup key of the dispatch: the insert of the event id is
    what a concurrent replay loses, and it lives in the same transaction as
    the state the event changes — an event either lands with its effect or
    not at all.
    """

    def __init__(self, session: Session) -> None:
        """Binds the repository to a database session.

        Args:
            session: Session shared with the rest of the webhook dispatch.
        """
        self.session = session

    def find(self, event_id: str) -> WebhookEvent | None:
        """Returns the record of an already-delivered event.

        Args:
            event_id: Asaas event id.

        Returns:
            The recorded event, or `None` when this is the first delivery.
        """
        return self.session.get(WebhookEvent, event_id)

    def add(self, event_id: str, event_type: str) -> WebhookEvent:
        """Registers an arrival without flushing or committing.

        The caller flushes right away so a concurrent duplicate loses the
        insert race before any state is changed, and commits once at the end.

        Args:
            event_id: Asaas event id (the primary key).
            event_type: Asaas event name.

        Returns:
            The pending `WebhookEvent` row.
        """
        event = WebhookEvent(event_id=event_id, event_type=event_type)
        self.session.add(event)
        return event
