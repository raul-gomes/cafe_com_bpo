from sqlalchemy import (
    Column,
    String,
    DateTime,
    func,
    ForeignKey,
    UUID,
    Text,
    Integer,
    Boolean,
    Float,
    JSON,
)
from sqlalchemy.orm import relationship
from src.core.database import Base
from typing import Optional
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
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False, default="#6b7280")
    order = Column(Integer, nullable=False, default=0)
    is_default = Column(Boolean, server_default="false", nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tasks = relationship("Task", back_populates="phase")


class Task(Base):
    """
    Representa uma tarefa (Task) de BPO vinculada a uma Empresa (Client) e Usuário.
    """

    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Phase (replaces status)
    phase_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task_phases.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Legacy status field (kept for backward compat during migration)
    status = Column(String(50), server_default="todo", nullable=False)

    # Prioridade: low, medium, high
    priority = Column(String(50), server_default="medium", nullable=False)

    # Tipo de processo: fiscal, contabil, dp, financeiro, administrativo
    process_type = Column(String(50), nullable=True)

    deadline = Column(DateTime(timezone=True), nullable=True)

    # Scheduling
    time_estimate_hours = Column(Integer, nullable=True)

    # Notes
    notes = Column(Text, nullable=True)

    # Template / Routine tracking
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    assignment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_template_assignments.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    phase = relationship("TaskPhase", back_populates="tasks")
    attachments = relationship(
        "TaskAttachment",
        back_populates="task",
        cascade="all, delete-orphan",
        foreign_keys="TaskAttachment.task_id",
    )
    template = relationship("ActivityTemplate", foreign_keys=[template_id])

    @property
    def template_name(self) -> Optional[str]:
        return self.template.name if self.template else None


# ──────────────────────────────────────────────
# NOVOS MODELOS — Client-Centric Task Manager
# ──────────────────────────────────────────────


class RoutineType(Base):
    """
    Tipo de rotina customizável pelo usuário.
    Ex: 'Fiscal', 'Contábil', 'DP' — com cor para badge.
    """

    __tablename__ = "routine_types"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(100), nullable=False)
    color = Column(String(10), nullable=True)
    suggestions = Column(JSON, nullable=True)  # Optional array of suggested activity names
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class ActivityTemplate(Base):
    """
    Pacote de serviços recorrentes (ex: 'Fiscal Mensal').
    Define um conjunto de atividades que são geradas automaticamente
    quando vinculado a um cliente.
    """

    __tablename__ = "activity_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    process_type = Column(String(50), nullable=True)
    recurrence = Column(
        String(50), nullable=False, default="monthly"
    )  # once, daily, weekly, biweekly, monthly, quarterly, yearly
    weekday_mask = Column(String(20), nullable=True)  # ex: "0,2,4" (dom=0, seg=1, ...)
    due_day = Column(Integer, nullable=True)  # dia do mês para recorrência mensal (1-31)
    due_month = Column(Integer, nullable=True)  # mês para recorrência anual (1-12)
    due_days_from_start = Column(Integer, nullable=True)  # dias a partir do start para "once"
    due_date = Column(DateTime(timezone=True), nullable=True)
    recurrence_end_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, server_default="true", nullable=False)
    routine_type_id = Column(
        UUID(as_uuid=True),
        ForeignKey("routine_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    activities = relationship(
        "TemplateActivity",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="TemplateActivity.order",
    )

    routine_type = relationship("RoutineType", foreign_keys=[routine_type_id])


class TemplateActivity(Base):
    """
    Cada atividade DENTRO de um template.
    Ex: 'Apuração de tributos' com vencimento dia 20.
    """

    __tablename__ = "template_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), nullable=False, server_default="medium")  # low, medium, high
    due_day = Column(Integer, nullable=True)  # dia do mês (1-31) - opcional, usa do template se null
    due_days = Column(Integer, nullable=True)  # dias após início (alternativa a due_day)
    estimated_hours = Column(Integer, nullable=True)  # horas estimadas
    order = Column(Integer, nullable=False, default=0)  # ordenação
    phase_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task_phases.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    template = relationship("ActivityTemplate", back_populates="activities")


class ClientTemplateAssignment(Base):
    """
    Liga um cliente a um template de atividades.
    Quando criado, dispara a geração automática das tarefas.
    """

    __tablename__ = "client_template_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    start_date = Column(DateTime(timezone=True), nullable=True)  # quando começa a gerar
    is_active = Column(Boolean, server_default="true", nullable=False)
    last_generated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    client = relationship("Client", foreign_keys=[client_id])
    template = relationship("ActivityTemplate", foreign_keys=[template_id])


class ClientSLA(Base):
    """
    SLA por cliente + tipo de processo.
    Define quantos dias (corridos) o BPO tem para executar cada tipo de tarefa.
    """

    __tablename__ = "client_slas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    process_type = Column(String(50), nullable=False)
    sla_days = Column(Integer, nullable=False, default=5)  # dias corridos
    warning_threshold = Column(
        Float, nullable=False, default=0.8
    )  # 80% do prazo = alerta
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TaskAttachment(Base):
    """
    Arquivos anexados a uma tarefa.
    Suporta upload de documentos e tracking de envio por email.
    """

    __tablename__ = "task_attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # bytes
    content_type = Column(String(100), nullable=True)  # MIME type
    uploaded_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sent_to_client = Column(Boolean, server_default="false", nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    task = relationship("Task", back_populates="attachments", foreign_keys=[task_id])
    uploader = relationship("User", foreign_keys=[uploaded_by])
