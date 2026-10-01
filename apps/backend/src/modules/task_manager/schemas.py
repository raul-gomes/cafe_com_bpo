from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    client_id: UUID
    priority: str = "medium"
    process_type: str | None = None
    deadline: datetime | None = None
    time_estimate_minutes: int | None = None
    notes: str | None = None
    phase_id: UUID | None = None
    cancelled_at: datetime | None = None
    is_cancelled: bool = False
    is_active: bool = True
    completed_at: datetime | None = None


class TaskCreate(TaskBase):
    template_id: UUID | None = None
    assignment_id: UUID | None = None
    routine_instance_id: UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    client_id: UUID | None = None
    priority: str | None = None
    process_type: str | None = None
    deadline: datetime | None = None
    time_estimate_minutes: int | None = None
    notes: str | None = None
    phase_id: UUID | None = None
    cancelled_at: datetime | None = None
    is_cancelled: bool | None = None


class TaskResponse(TaskBase):
    id: UUID
    user_id: UUID
    phase_id: UUID | None = None
    phase: "TaskPhaseResponse | None" = None
    template_id: UUID | None = None
    assignment_id: UUID | None = None
    routine_instance_id: UUID | None = None
    template_name: str | None = None
    moved_by: UUID | None = None
    moved_by_name: str | None = None
    assignee_name: str | None = None
    client_name: str | None = None
    client_color: str | None = None
    # Estado derivado no servidor (read-to-render): a regra de prazo é de
    # calendário e o front a re-derivava em `deadline.ts` — mesma tarefa, dois
    # vereditos conforme a tela.
    days_remaining: int | None = None
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime
    cancelled_at: datetime | None = None
    is_cancelled: bool = False
    completed_at: datetime | None = None
    deleted_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class TaskPhaseBase(BaseModel):
    name: str
    color: str = "#6b7280"
    order: int = 0
    is_done: bool = False


class TaskPhaseCreate(TaskPhaseBase):
    pass


class TaskPhaseUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    order: int | None = None
    is_done: bool | None = None


class TaskPhaseReorder(BaseModel):
    phases: list[dict]


class TaskPhaseResponse(TaskPhaseBase):
    id: UUID
    is_default: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskAIAnalyzeInput(BaseModel):
    title: str
    description: str | None = None
    process_type: str | None = None


class TaskAIAnalyzeResponse(BaseModel):
    suggested_priority: str
    suggested_process_type: str | None = None
    estimated_deadline_days: int | None = None
    reasoning: str


class TaskAISuggestResponse(BaseModel):
    suggestions: list[dict]


class TimelineTaskResponse(BaseModel):
    id: UUID
    title: str
    client_id: UUID
    deadline: datetime | None = None
    time_estimate_minutes: int | None = None
    priority: str
    process_type: str | None = None
    phase: "TaskPhaseResponse | None" = None


class TimelineDayResponse(BaseModel):
    date: str
    tasks: list[TimelineTaskResponse]
    total_minutes: int


class TimelineResponse(BaseModel):
    timeline: list[TimelineDayResponse]


class ConflictResponse(BaseModel):
    date: str
    tasks: list[dict]
    total_minutes: int


class ConflictsResponse(BaseModel):
    conflicts: list[ConflictResponse]


# ──────────────────────────────────────────────
# Activity Template Schemas
# ──────────────────────────────────────────────


# ──────────────────────────────────────────────
# Routine Type Schemas
# ──────────────────────────────────────────────


class RoutineTypeBase(BaseModel):
    name: str
    color: str | None = None
    suggestions: list[str] | None = None


class RoutineTypeCreate(RoutineTypeBase):
    pass


class RoutineTypeUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    suggestions: list[str] | None = None


class RoutineTypeResponse(RoutineTypeBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateActivityBase(BaseModel):
    name: str
    description: str | None = None
    priority: str = "medium"  # low, medium, high
    due_day: int | None = None  # 1-31, opcional (usa do template se null)
    due_days: int | None = None  # dias após início (alternativa)
    estimated_minutes: int | None = None
    order: int = 0
    phase_id: UUID | None = None


class TemplateActivityCreate(TemplateActivityBase):
    pass


class TemplateActivityUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    priority: str | None = None  # low, medium, high
    due_day: int | None = None
    due_days: int | None = None
    estimated_minutes: int | None = None
    order: int | None = None
    phase_id: UUID | None = None


class TemplateActivityResponse(BaseModel):
    """One activity of a template, as the detail page and drawer render it.

    Out, because no screen reads them: `template_id` (the activities are nested
    under the template that owns them), `due_day`/`due_days` (the schedule is
    write-only — it reaches the card through the generated deadline, so no
    component needs to re-read it), `phase_id` (phases belong to tasks, not to
    the template activities) and `created_at`.
    """

    id: UUID
    name: str
    description: str | None = None
    priority: str
    estimated_minutes: int | None = None
    order: int = 0

    model_config = ConfigDict(from_attributes=True)


class ActivityTemplateBase(BaseModel):
    name: str
    description: str | None = None
    process_type: str | None = None
    recurrence: str = "monthly"
    weekday_mask: str | None = None  # ex: "0,2,4" (dom=0, seg=1, ...)
    due_day: int | None = None  # dia do mês p/ mensal (1-31)
    due_month: int | None = None  # 1-12, para recorrência anual
    due_days_from_start: int | None = None  # dias p/ "once"
    due_date: datetime | None = None
    recurrence_end_date: datetime | None = None
    is_active: bool = True
    is_general: bool = (
        False  # rotina geral: visível/vinculável por todos (criação: só admin)
    )
    is_archived: bool = False  # rotina arquivada: fica no final da página
    routine_type_id: UUID | None = None


class ActivityTemplateCreate(ActivityTemplateBase):
    pass


class ActivityTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    process_type: str | None = None
    recurrence: str | None = None
    weekday_mask: str | None = None
    due_day: int | None = None
    due_month: int | None = None
    due_days_from_start: int | None = None
    due_date: datetime | None = None
    recurrence_end_date: datetime | None = None
    is_active: bool | None = None
    is_archived: bool | None = None
    routine_type_id: UUID | None = None


class ActivityTemplateResponse(BaseModel):
    """A template with its activities, as the detail page and drawer render it.

    Carries the schedule fields (`ActivityTemplateBase`) plus the owner, since
    the list only offers archive/delete on a personal template to its creator,
    and the resolved routine type name and color of the badges.

    Out, because no screen reads them: `parent_template_id` (the fork is
    created server-side, the UI never links back to the general template),
    `due_date`/`recurrence_end_date` (the recurrence is described by
    `recurrence` + `weekday_mask` + `due_day`/`due_month`/`due_days_from_start`
    and the edit form prefills from those) and `created_at`/`updated_at`.
    """

    id: UUID
    user_id: UUID
    name: str
    description: str | None = None
    process_type: str | None = None
    recurrence: str
    weekday_mask: str | None = None
    due_day: int | None = None
    due_month: int | None = None
    due_days_from_start: int | None = None
    is_active: bool = True
    is_general: bool = False
    is_archived: bool = False
    routine_type_id: UUID | None = None
    routine_type_name: str | None = None
    routine_type_color: str | None = None
    activities: list[TemplateActivityResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ActivityTemplateListItem(BaseModel):
    """One row of the template list, without the nested activities.

    `ActivityTemplateResponse` plus the three values the list computes on its
    own — `is_overdue`, `days_overdue` and `activity_count` — which the overdue
    filter, the badge and the sort by urgency read.
    """

    id: UUID
    user_id: UUID
    name: str
    description: str | None = None
    process_type: str | None = None
    recurrence: str
    weekday_mask: str | None = None
    due_day: int | None = None
    due_month: int | None = None
    due_days_from_start: int | None = None
    is_active: bool
    is_general: bool = False
    is_archived: bool = False
    is_overdue: bool = False
    days_overdue: int = 0
    activity_count: int = 0
    routine_type_id: UUID | None = None
    routine_type_name: str | None = None
    routine_type_color: str | None = None

    model_config = ConfigDict(from_attributes=True)


class OverdueTemplateResponse(BaseModel):
    """One overdue template, as the dashboard alert renders it.

    The alert only shows the name, the recurrence label, how many activities the
    template has and how many days late it is, plus the id it navigates with.
    Everything else the full template DTO carries is dead weight here.
    """

    id: UUID
    name: str
    recurrence: str
    days_overdue: int
    activity_count: int = 0


# ──────────────────────────────────────────────
# Client Template Assignment Schemas
# ──────────────────────────────────────────────


class ClientTemplateAssignmentCreate(BaseModel):
    client_id: UUID
    template_id: UUID
    start_date: datetime | None = None


class ClientTemplateAssignmentUpdate(BaseModel):
    is_active: bool | None = None


class ClientTemplateAssignmentResponse(BaseModel):
    """One template linked to a client, as the company page renders it.

    The page shows the active toggle and removes or refreshes the link by id,
    and matches the linked templates by `template_id`. Out, because nothing
    renders them: `user_id` (the link list is already scoped to the caller),
    `start_date`, `last_generated_at`, `created_at` and `updated_at`.
    """

    id: UUID
    client_id: UUID
    template_id: UUID
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ClientTemplateAssignResponse(BaseModel):
    """What linking a template to a client answers: the link and the task count.

    `template_name` is out — the page refetches the list, which already carries
    the template rows it renders.
    """

    assignment_id: UUID
    tasks_generated: int


class ClientTemplateRegenerateResponse(BaseModel):
    """What regenerating a client's tasks answers: how many were created."""

    tasks_generated: int


# ──────────────────────────────────────────────
# SLA Schemas
# ──────────────────────────────────────────────


class ClientSLABase(BaseModel):
    client_id: UUID
    process_type: str
    sla_days: int = 5
    warning_threshold: float = 0.8


class ClientSLACreate(ClientSLABase):
    pass


class ClientSLAUpdate(BaseModel):
    sla_days: int | None = None
    warning_threshold: float | None = None


class ClientSLAResponse(ClientSLABase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────
# Attachment Schemas
# ──────────────────────────────────────────────


class TaskAttachmentResponse(BaseModel):
    id: UUID
    task_id: UUID
    file_name: str
    file_size: int | None = None
    content_type: str | None = None
    uploaded_by: UUID | None = None
    sent_to_client: bool
    sent_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────
# Client Timeline Schemas
# ──────────────────────────────────────────────


class ClientTimelineTask(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    phase_id: UUID | None = None
    phase: "TaskPhaseResponse | None" = None
    priority: str
    process_type: str | None = None
    deadline: datetime | None = None
    time_estimate_minutes: int | None = None
    sla_status: str = "on_time"  # on_time, warning, overdue
    sla_days_used: int | None = None
    sla_days_limit: int | None = None
    attachment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientTimelineStats(BaseModel):
    total: int = 0
    completed: int = 0
    on_time: int = 0
    warning: int = 0
    overdue: int = 0
    in_progress: int = 0


class ClientTimelineResponse(BaseModel):
    client_id: UUID
    client_name: str
    client_email: str | None = None
    month: str
    stats: ClientTimelineStats
    slas: list[dict] = []
    tasks: list[ClientTimelineTask]


# ──────────────────────────────────────────────
# Dashboard Alert Schemas
# ──────────────────────────────────────────────


class SLAAlert(BaseModel):
    type: str  # "overdue" or "warning"
    message: str
    count: int
    tasks: list[dict]


class SLAAlertsResponse(BaseModel):
    overdue: list[SLAAlert]
    warning: list[SLAAlert]
    total_overdue: int
    total_warning: int
