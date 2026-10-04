from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.payments.models import Payment


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

    def update_status(
        self, payment_id: UUID, status: str, webhook_data: dict | None = None
    ) -> Payment:
        """Applies a webhook result to a payment.

        Args:
            payment_id: Payment to update.
            status: New status.
            webhook_data: Payload to keep for idempotency and audit.

        Returns:
            The updated payment.
        """
        payment = self.session.query(Payment).filter(Payment.id == payment_id).first()
        if payment:
            payment.status = status
            if webhook_data:
                payment.webhook_data = webhook_data
            self.session.commit()
            self.session.refresh(payment)
        return payment
