from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.payments.models import Payment


class UserCustomer:
    def __init__(self, user_id: UUID, asaas_customer_id: str):
        self.user_id = user_id
        self.asaas_customer_id = asaas_customer_id


class PaymentRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_user(self, user_id: UUID) -> list[Payment]:
        return (
            self.session.query(Payment)
            .filter(Payment.user_id == user_id)
            .order_by(Payment.created_at.desc())
            .all()
        )

    def get_by_id(self, payment_id: UUID, user_id: UUID) -> Payment | None:
        return (
            self.session.query(Payment)
            .filter(Payment.id == payment_id, Payment.user_id == user_id)
            .first()
        )

    def get_by_asaas_id(self, asaas_payment_id: str) -> Payment | None:
        return (
            self.session.query(Payment)
            .filter(Payment.asaas_payment_id == asaas_payment_id)
            .first()
        )

    def get_customer_by_user(self, user_id: UUID) -> UserCustomer | None:
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
        payment = self.session.query(Payment).filter(Payment.id == payment_id).first()
        if payment:
            payment.status = status
            if webhook_data:
                payment.webhook_data = webhook_data
            self.session.commit()
            self.session.refresh(payment)
        return payment
