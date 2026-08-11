import uuid

from sqlalchemy import (
    JSON,
    UUID,
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    func,
)

from src.core.database import Base


class EmailDelivery(Base):
    """
    Registro de envio de e-mail transacional.

    Funciona como fila inicial: a API cria registros com status 'pending'
    e o trabalhador processa posteriormente, sem bloquear a requisição.
    """

    __tablename__ = "email_deliveries"
    __table_args__ = (Index("ix_email_deliveries_pending", "status", "scheduled_at"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kind = Column(String(50), nullable=False)
    recipient = Column(String(320), nullable=False)
    template = Column(String(100), nullable=False)
    payload = Column(JSON, nullable=False, default=dict)
    status = Column(String(30), nullable=False, default="pending")
    attempts = Column(Integer, nullable=False, default=0)
    idempotency_key = Column(String(255), unique=True, nullable=False)
    provider_message_id = Column(String(255), nullable=True)
    last_error = Column(Text, nullable=True)
    scheduled_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    locked_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    webhook_processed = Column(Boolean, default=False, nullable=False)
