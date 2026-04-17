from sqlalchemy import Column, String, DateTime, func, ForeignKey, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import Base
import uuid

class PricingScenario(Base):
    """
    Representa a entidade do Cenário de Precificação.
    """
    __tablename__ = "pricing_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Referência ao tabela users do módulo auth
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_name = Column(String(255), nullable=False)
    input_payload = Column(JSON(), nullable=False)
    result_payload = Column(JSON(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
