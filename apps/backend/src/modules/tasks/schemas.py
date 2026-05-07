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


class TaskResponse(TaskBase):
    id: UUID
    user_id: UUID
    routine_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoutineBase(BaseModel):
    title: str
    description: Optional[str] = None
    client_id: Optional[UUID] = None
    process_type: Optional[str] = None
    priority: str = "medium"
    recurrence: str
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    days_before_deadline: int = 0
    deadline_time: Optional[str] = None
    is_active: bool = True


class RoutineCreate(RoutineBase):
    pass


class RoutineUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[UUID] = None
    process_type: Optional[str] = None
    priority: Optional[str] = None
    recurrence: Optional[str] = None
    day_of_week: Optional[int] = None
    day_of_month: Optional[int] = None
    days_before_deadline: Optional[int] = None
    deadline_time: Optional[str] = None
    is_active: Optional[bool] = None


class RoutineResponse(RoutineBase):
    id: UUID
    user_id: UUID
    last_generated: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

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
