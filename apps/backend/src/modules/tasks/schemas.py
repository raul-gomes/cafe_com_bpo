from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: UUID
    status: str = "todo"
    priority: str = "medium"
    process_type: Optional[str] = None
    deadline: Optional[datetime] = None
    time_estimate_hours: Optional[int] = None
    phase_id: Optional[UUID] = None
    cancelled_at: Optional[datetime] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[UUID] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    process_type: Optional[str] = None
    deadline: Optional[datetime] = None
    time_estimate_hours: Optional[int] = None
    phase_id: Optional[UUID] = None
    cancelled_at: Optional[datetime] = None


class TaskResponse(TaskBase):
    id: UUID
    user_id: UUID
    phase_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class TaskPhaseBase(BaseModel):
    name: str
    color: str = "#6b7280"
    order: int = 0


class TaskPhaseCreate(TaskPhaseBase):
    pass


class TaskPhaseUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    order: Optional[int] = None


class TaskPhaseReorder(BaseModel):
    phases: list[dict]


class TaskPhaseResponse(TaskPhaseBase):
    id: UUID
    user_id: UUID
    is_default: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskAIAnalyzeInput(BaseModel):
    title: str
    description: Optional[str] = None
    process_type: Optional[str] = None


class TaskAIAnalyzeResponse(BaseModel):
    suggested_priority: str
    suggested_process_type: Optional[str] = None
    estimated_deadline_days: Optional[int] = None
    reasoning: str


class TaskAISuggestResponse(BaseModel):
    suggestions: list[dict]


class TimelineTaskResponse(BaseModel):
    id: UUID
    title: str
    client_id: UUID
    deadline: Optional[datetime] = None
    time_estimate_hours: Optional[int] = None
    priority: str
    process_type: Optional[str] = None
    status: str


class TimelineDayResponse(BaseModel):
    date: str
    tasks: list[TimelineTaskResponse]
    total_hours: int


class TimelineResponse(BaseModel):
    timeline: list[TimelineDayResponse]


class ConflictResponse(BaseModel):
    date: str
    tasks: list[dict]
    total_hours: int


class ConflictsResponse(BaseModel):
    conflicts: list[ConflictResponse]


# ──────────────────────────────────────────────
# Activity Template Schemas
# ──────────────────────────────────────────────


class TemplateActivityBase(BaseModel):
    name: str
    description: Optional[str] = None
    due_day: int  # 1-31
    estimated_hours: Optional[int] = None
    order: int = 0
    phase_id: Optional[UUID] = None


class TemplateActivityCreate(TemplateActivityBase):
    pass


class TemplateActivityUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    due_day: Optional[int] = None
    estimated_hours: Optional[int] = None
    order: Optional[int] = None
    phase_id: Optional[UUID] = None


class TemplateActivityResponse(TemplateActivityBase):
    id: UUID
    template_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    process_type: Optional[str] = None
    recurrence: str = "monthly"
    due_date: Optional[datetime] = None
    recurrence_end_date: Optional[datetime] = None
    is_active: bool = True


class ActivityTemplateCreate(ActivityTemplateBase):
    pass


class ActivityTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    process_type: Optional[str] = None
    recurrence: Optional[str] = None
    due_date: Optional[datetime] = None
    recurrence_end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class ActivityTemplateResponse(ActivityTemplateBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime
    activities: list[TemplateActivityResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ActivityTemplateListItem(BaseModel):
    """List item without nested activities for performance."""

    id: UUID
    name: str
    description: Optional[str] = None
    process_type: Optional[str] = None
    recurrence: str
    due_date: Optional[datetime] = None
    recurrence_end_date: Optional[datetime] = None
    is_active: bool
    is_overdue: bool = False
    days_overdue: int = 0
    activity_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OverdueTemplateResponse(BaseModel):
    """Overdue template info for dashboard alerts."""

    id: UUID
    name: str
    description: Optional[str] = None
    process_type: Optional[str] = None
    recurrence: str
    due_date: Optional[datetime] = None
    recurrence_end_date: Optional[datetime] = None
    is_active: bool
    days_overdue: int
    activity_count: int = 0


# ──────────────────────────────────────────────
# Client Template Assignment Schemas
# ──────────────────────────────────────────────


class ClientTemplateAssignmentCreate(BaseModel):
    client_id: UUID
    template_id: UUID
    start_date: Optional[datetime] = None


class ClientTemplateAssignmentResponse(BaseModel):
    id: UUID
    client_id: UUID
    template_id: UUID
    user_id: UUID
    start_date: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    sla_days: Optional[int] = None
    warning_threshold: Optional[float] = None


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
    file_size: Optional[int] = None
    content_type: Optional[str] = None
    uploaded_by: Optional[UUID] = None
    sent_to_client: bool
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────
# Client Timeline Schemas
# ──────────────────────────────────────────────


class ClientTimelineTask(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    phase_id: Optional[UUID] = None
    status: str
    priority: str
    process_type: Optional[str] = None
    deadline: Optional[datetime] = None
    time_estimate_hours: Optional[int] = None
    sla_status: str = "on_time"  # on_time, warning, overdue
    sla_days_used: Optional[int] = None
    sla_days_limit: Optional[int] = None
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
    client_email: Optional[str] = None
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
