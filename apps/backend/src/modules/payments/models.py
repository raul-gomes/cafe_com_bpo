from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from src.core.database import Base
import uuid


class Payment(Base):
    __tablename__ = "payments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    asaas_customer_id = Column(String(100), nullable=True)
    asaas_payment_id = Column(String(100), nullable=True)

    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String(50), server_default="pending", nullable=False)

    payment_method = Column(String(50), nullable=False)

    due_date = Column(String(10), nullable=False)

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
