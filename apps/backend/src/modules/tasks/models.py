from sqlalchemy import Column, String, DateTime, func, ForeignKey, UUID, Text, Integer, Boolean, JSON
from sqlalchemy.orm import relationship
from src.core.database import Base
import uuid

DEFAULT_PHASES = [
    {"name": "A Fazer", "color": "#6b7280", "order": 0},
    {"name": "Em Andamento", "color": "#3b82f6", "order": 1},
    {"name": "Concluído", "color": "#22c55e", "order": 2},
]

class TaskPhase(Base):
    """
    Customizable Kanban phase/column for task management.
    Each user can define their own phases.
    """
    __tablename__ = "task_phases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False, default="#6b7280")
    order = Column(Integer, nullable=False, default=0)
    is_default = Column(Boolean, server_default="false", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    tasks = relationship("Task", back_populates="phase")


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

    # Phase (replaces status)
    phase_id = Column(UUID(as_uuid=True), ForeignKey("task_phases.id", ondelete="SET NULL"), nullable=True)

    # Legacy status field (kept for backward compat during migration)
    status = Column(String(50), server_default="todo", nullable=False)

    # Prioridade: low, medium, high
    priority = Column(String(50), server_default="medium", nullable=False)

    # Tipo de processo: fiscal, contabil, dp, financeiro, administrativo
    process_type = Column(String(50), nullable=True)

    deadline = Column(DateTime(timezone=True), nullable=True)

    # Recurrence tracking
    routine_id = Column(UUID(as_uuid=True), ForeignKey("routines.id", ondelete="SET NULL"), nullable=True)

    # Scheduling
    time_estimate_hours = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    routine = relationship("Routine", back_populates="tasks")
    phase = relationship("TaskPhase", back_populates="tasks")


class Routine(Base):
    """
    Representa uma tarefa recorrente (Rotina) que gera tarefas automaticamente.
    """
    __tablename__ = "routines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Tipo de processo: fiscal, contabil, dp, financeiro, administrativo
    process_type = Column(String(50), nullable=True)
    
    # Prioridade: low, medium, high
    priority = Column(String(50), server_default="medium", nullable=False)
    
    # Recurrence: daily, weekly, monthly, yearly
    recurrence = Column(String(50), nullable=False)
    
    # Day of week for weekly (0=Monday, 6=Sunday)
    day_of_week = Column(Integer, nullable=True)
    
    # Day of month for monthly/yearly (1-31)
    day_of_month = Column(Integer, nullable=True)
    
    # Generate tasks X days before the deadline
    days_before_deadline = Column(Integer, server_default="0", nullable=False)
    
    # Deadline time (HH:MM)
    deadline_time = Column(String(5), nullable=True)
    
    is_active = Column(Boolean, server_default="true", nullable=False)
    
    # Last generated task date
    last_generated = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tasks = relationship("Task", back_populates="routine")
