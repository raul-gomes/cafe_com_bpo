import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from src.core.database import Base


class Payment(Base):
    """A billing entry — the unit of "paid month" on the payments screen (§17.2).

    The row mirrors the charge in Asaas, written by the authenticated webhook.
    `subscription_id` ties the charge to the subscription cycle and is `NULL` on
    legacy rows (the one-off billing that predates the subscription model) — they
    stay in the database, they just do not show on the new screen.
    """

    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_user_id", "user_id"),)

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    asaas_customer_id = Column(String(100), nullable=True)
    asaas_payment_id = Column(String(100), nullable=True)

    # Money in `Numeric`, never in `Float`: the month-by-month sum is money the
    # user checks on the screen (§15 follows the same doctrine).
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String(50), server_default="pending", nullable=False)

    payment_method = Column(String(50), nullable=False)

    due_date = Column(String(10), nullable=False)

    # --- Subscription cycle (§17.2) ---
    subscription_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("subscriptions.id", ondelete="CASCADE"),
        nullable=True,
    )
    # Billing month as `YYYY-MM`: what the screen groups as a "paid month".
    cycle_month = Column(String(7), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    invoice_url = Column(String(500), nullable=True)
    credit_card_brand = Column(String(50), nullable=True)
    credit_card_last4 = Column(String(4), nullable=True)

    webhook_data = Column(JSON, nullable=True)

    success_url = Column(String(500), nullable=True)
    error_url = Column(String(500), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="payments")
