from sqlalchemy import Column, String, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from src.core.database import Base
from src.modules.network.models import DiscussionPost, DiscussionComment, Notification
import uuid

class User(Base):
    """
    Representa a entidade de um Usuário no banco de dados.

    Utilizado para autenticação e relacionamento com as regras de modelo.
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(150), nullable=True)
    company = Column(String(150), nullable=True)
    auth_provider = Column(String(50), default="local", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class PricingScenario(Base):
    """
    Representa a entidade do Cenário de Precificação.

    Armazena o JSON original de input e o JSON processado como output (resultado).
    """
    __tablename__ = "pricing_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_name = Column(String(255), nullable=False)
    input_payload = Column(JSONB, nullable=False)
    result_payload = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
