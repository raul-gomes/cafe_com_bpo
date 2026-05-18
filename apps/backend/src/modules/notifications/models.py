"""
Notifications Module - Models

In-app notification system with decoupled dispatcher architecture.
"""

from sqlalchemy import Column, String, DateTime, func, ForeignKey, UUID, Boolean
from sqlalchemy.orm import relationship
from src.core.database import Base
import uuid


class AppNotification(Base):
    """
    In-app notification for users.
    Decoupled from delivery channel (future: email, WhatsApp via dispatcher).
    """

    __tablename__ = "app_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String(255), nullable=False)
    message = Column(String(1000), nullable=False)
    type = Column(String(50), nullable=False)
    is_read = Column(Boolean, server_default="false", nullable=False, default=False)

    # Optional reference to the entity that triggered this notification
    related_entity_type = Column(String(50), nullable=True)
    related_entity_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="notifications")
