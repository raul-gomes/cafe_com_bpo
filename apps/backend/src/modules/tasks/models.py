from sqlalchemy import Column, String, DateTime, func, ForeignKey, UUID, Text
from src.core.database import Base
import uuid

class Task(Base):
    """
    Representa uma tarefa (Task) de BPO vinculada a uma Empresa (Client) e Usuário.
    """
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Status: todo, doing, done
    status = Column(String(50), server_default="todo", nullable=False)
    
    # Prioridade: low, medium, high
    priority = Column(String(50), server_default="medium", nullable=False)
    
    deadline = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
