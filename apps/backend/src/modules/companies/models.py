from sqlalchemy import Column, String, Text, DateTime, func, UUID, ForeignKey
from sqlalchemy.orm import relationship
from src.core.database import Base
import uuid


class Company(Base):
    """
    Representa uma empresa vinculada a um usuário.
    """

    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    segment = Column(String(100), nullable=True)
    description = Column(Text(), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="companies")
