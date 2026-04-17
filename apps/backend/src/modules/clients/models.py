from sqlalchemy import Column, String, DateTime, func, UUID, ForeignKey
from src.core.database import Base
import uuid

class Client(Base):
    """
    Representa a entidade de um Cliente (Empresa) vinculado a um Usuário.
    """
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Vinculado ao usuário que cadastrou
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    cnpj = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    color = Column(String(10), nullable=True) # Armazena hex ex: #4287f5

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
