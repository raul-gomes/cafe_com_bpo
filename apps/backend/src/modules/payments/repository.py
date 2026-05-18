from typing import List, Optional
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

    def get_by_user(self, user_id: UUID) -> List[Payment]:
        return (
            self.session.query(Payment)
            .filter(Payment.user_id == user_id)
            .order_by(Payment.created_at.desc())
            .all()
        )

    def get_by_id(self, payment_id: UUID, user_id: UUID) -> Optional[Payment]:
        return (
            self.session.query(Payment)
            .filter(Payment.id == payment_id, Payment.user_id == user_id)
            .first()
        )

    def get_by_asaas_id(self, asaas_payment_id: str) -> Optional[Payment]:
        return (
            self.session.query(Payment)
            .filter(Payment.asaas_payment_id == asaas_payment_id)
            .first()
        )

    def get_customer_by_user(self, user_id: UUID) -> Optional[UserCustomer]:
        from sqlalchemy import text

        result = self.session.execute(
            text(
                "SELECT id, asaas_customer_id FROM payments WHERE user_id = :uid AND asaas_customer_id IS NOT NULL LIMIT 1"
            ),
            {"uid": str(user_id)},
        ).first()
        if result:
            return UserCustomer(user_id=user_id, asaas_customer_id=result[1])
        return None

    def save_customer_id(self, user_id: UUID, asaas_customer_id: str) -> None:
        from sqlalchemy import text

        self.session.execute(
            text(
                "UPDATE users SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{asaas_customer_id}', :cid) WHERE id = :uid"
            ),
            {"uid": str(user_id), "cid": f'"{asaas_customer_id}"'},
        )
        self.session.commit()

    def create_payment(
        self,
        user_id: UUID,
        amount: float,
        description: Optional[str],
        payment_method: str,
        due_date: str,
        asaas_customer_id: str,
        asaas_payment_id: str,
        success_url: Optional[str] = None,
        error_url: Optional[str] = None,
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
        self, payment_id: UUID, status: str, webhook_data: Optional[dict] = None
    ) -> Payment:
        payment = self.session.query(Payment).filter(Payment.id == payment_id).first()
        if payment:
            payment.status = status
            if webhook_data:
                payment.webhook_data = webhook_data
            self.session.commit()
            self.session.refresh(payment)
        return payment
