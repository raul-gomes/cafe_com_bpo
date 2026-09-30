import uuid
from typing import Optional

from sqlalchemy import (
    JSON,
    UUID,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from src.core.database import Base
from src.core.deadline import days_remaining, is_overdue

DEFAULT_PHASES = [
    {"name": "a fazer", "color": "#6b7280", "order": 0, "is_done": False},
    {"name": "em andamento", "color": "#3b82f6", "order": 1, "is_done": False},
    {"name": "concluido", "color": "#22c55e", "order": 2, "is_done": True},
]


def get_done_phase(phases: list) -> Optional["TaskPhase"]:
    """Return the phase marked as done (final/complete column).

    Prefers the explicit ``is_done`` flag; falls back to the highest ``order``
    so renaming phases never breaks logic and older boards keep working.
    """
    if not phases:
        return None
    done = next((p for p in phases if p.is_done), None)
    if done:
        return done
    return max(phases, key=lambda p: p.order)


class TaskPhase(Base):
    """
    Fases canônicas GLOBAIS do Kanban (compartilhadas por todos os usuários).
    Exatamente 3: "a fazer" (0), "em andamento" (1), "concluido" (2, done).
    """

    __tablename__ = "task_phases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    color = Column(String(7), nullable=False, default="#6b7280")
    order = Column(Integer, nullable=False, default=0)
    is_done = Column(Boolean, server_default="false", nullable=False)
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
    __table_args__ = (
        # "Só cliente tem equipe/rotina/SLA/tarefa" garantida pelo banco: a FK
        # composta só casa com companies.type = 'client'.
        CheckConstraint("company_type = 'client'", name="ck_tasks_company_type"),
        ForeignKeyConstraint(
            ["company_id", "company_type"],
            ["companies.id", "companies.type"],
            name="fk_tasks_company",
            ondelete="NO ACTION",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    # Escrita dupla: `client_id` continua valendo até a release de limpeza, e
    # é daqui que a leitura passa a sair. Nullable nesta fase — vira NOT NULL
    # em R3, depois que o backfill for conferido linha a linha.
    company_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    company_type = Column(
        String(20), nullable=False, server_default="client", default="client"
    )

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Phase (replaces status)
    phase_id = Column(
        UUID(as_uuid=True),
        ForeignKey("task_phases.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Prioridade: low, medium, high
    priority = Column(String(50), server_default="medium", nullable=False)

    # Tipo de processo: fiscal, contabil, dp, financeiro, administrativo
    process_type = Column(String(50), nullable=True)

    deadline = Column(DateTime(timezone=True), nullable=True)

    @property
    def days_remaining(self) -> int | None:
        """Dias de calendário até o prazo (regra única em `src/core/deadline`)."""
        return days_remaining(self.deadline)

    @property
    def is_overdue(self) -> bool:
        """Prazo **já passou** — "vence hoje" ainda não está atrasado.

        Vive no model (e não no service) porque a resposta é montada por
        `from_attributes`: assim lista, detalhe e dashboard falam do mesmo
        jeito sem cada rota remembering de preencher o campo.
        """
        return is_overdue(self.deadline)

    # Scheduling
    time_estimate_minutes = Column(Integer, nullable=True)
    routine_instance_id = Column(UUID(as_uuid=True), nullable=True, index=True)

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
    is_cancelled = Column(
        Boolean, server_default="false", default=False, nullable=False
    )
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Team tracking
    moved_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    phase = relationship("TaskPhase", back_populates="tasks")
    client = relationship("Client", foreign_keys=[client_id])
    attachments = relationship(
        "TaskAttachment",
        back_populates="task",
        cascade="all, delete-orphan",
        foreign_keys="TaskAttachment.task_id",
    )
    template = relationship("ActivityTemplate", foreign_keys=[template_id])
    mover = relationship("User", foreign_keys=[moved_by])
    assignee = relationship("User", foreign_keys=[user_id])

    @property
    def client_name(self) -> str | None:
        return self.client.name if self.client else None

    @property
    def client_color(self) -> str | None:
        return self.client.color if self.client else None

    @property
    def template_name(self) -> str | None:
        return self.template.name if self.template else None

    @property
    def moved_by_name(self) -> str | None:
        return self.mover.name if self.mover else None

    @property
    def assignee_name(self) -> str | None:
        return self.assignee.name if self.assignee else None


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
    suggestions = Column(
        JSON, nullable=True
    )  # Optional array of suggested activity names
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
    )  # once, daily, weekly, monthly, quarterly, yearly
    weekday_mask = Column(String(20), nullable=True)  # ex: "0,2,4" (dom=0, seg=1, ...)
    due_day = Column(
        Integer, nullable=True
    )  # dia do mês para recorrência mensal (1-31)
    due_month = Column(Integer, nullable=True)  # mês para recorrência anual (1-12)
    due_days_from_start = Column(
        Integer, nullable=True
    )  # dias a partir do start para "once"
    due_date = Column(DateTime(timezone=True), nullable=True)
    recurrence_end_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, server_default="true", nullable=False)
    # Rotina geral: criada por admin, visível e vinculável por todos os usuários
    is_general = Column(Boolean, server_default="false", nullable=False)
    # Rotina arquivada: fica no final da página, pode ser desarquivada
    is_archived = Column(Boolean, server_default="false", nullable=False)
    # Quando um usuário edita uma rotina geral, cria-se uma cópia privada (fork)
    # dele com parent_template_id apontando para o template original (mestre).
    parent_template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
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

    parent = relationship(
        "ActivityTemplate",
        remote_side=[id],
        foreign_keys=[parent_template_id],
    )
    forks = relationship(
        "ActivityTemplate",
        back_populates="parent",
        foreign_keys=[parent_template_id],
    )


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
    priority = Column(
        String(20), nullable=False, server_default="medium"
    )  # low, medium, high
    due_day = Column(
        Integer, nullable=True
    )  # dia do mês (1-31) - opcional, usa do template se null
    due_days = Column(
        Integer, nullable=True
    )  # dias após início (alternativa a due_day)
    estimated_minutes = Column(Integer, nullable=True)  # minutos estimados
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
    __table_args__ = (
        # "Só cliente tem equipe/rotina/SLA/tarefa" garantida pelo banco: a FK
        # composta só casa com companies.type = 'client'.
        CheckConstraint(
            "company_type = 'client'",
            name="ck_client_template_assignments_company_type",
        ),
        ForeignKeyConstraint(
            ["company_id", "company_type"],
            ["companies.id", "companies.type"],
            name="fk_client_template_assignments_company",
            ondelete="NO ACTION",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    company_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    company_type = Column(
        String(20), nullable=False, server_default="client", default="client"
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
    # `default=True` junto do `server_default`: sem o default do lado Python a
    # linha nasce com o literal do servidor, e a cascata (§16) — que filtra por
    # `is_active is true` — não encontra a linha em SQLite.
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    # Regra §16: a rotina é desativada junto com a empresa (e quando).
    deleted_at = Column(DateTime(timezone=True), nullable=True)
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
    __table_args__ = (
        # "Só cliente tem equipe/rotina/SLA/tarefa" garantida pelo banco: a FK
        # composta só casa com companies.type = 'client'.
        CheckConstraint("company_type = 'client'", name="ck_client_slas_company_type"),
        ForeignKeyConstraint(
            ["company_id", "company_type"],
            ["companies.id", "companies.type"],
            name="fk_client_slas_company",
            ondelete="NO ACTION",
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    company_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    company_type = Column(
        String(20), nullable=False, server_default="client", default="client"
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Regra §16: SLA também é desativado em cascata, nunca apagado.
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
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


class UserTemplateArchive(Base):
    """Registra que um usuário arquivou uma rotina geral.

    Para rotinas pessoais (is_general=False), o is_archived no próprio template
    é suficiente. Para rotinas gerais, cada usuário decide individualmente.
    """

    __tablename__ = "user_template_archives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "template_id", name="uq_user_template_archive"),
    )
