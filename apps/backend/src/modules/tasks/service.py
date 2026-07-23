"""
Tasks Module - Service Layer

Business logic for task and routine management.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from src.core.utils import next_business_day
from src.modules.tasks.repository import TaskRepository
from src.modules.tasks.models import (
    ActivityTemplate,
    TemplateActivity as TemplateActivityModel,
)
from src.modules.tasks.scheduler import (
    calculate_activity_deadline,
    get_weekly_deadlines_for_month,
    get_effective_due_day,
    build_routine_instance_id,
)
from src.modules.tasks.schemas import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskPhaseCreate,
    TaskPhaseUpdate,
    TaskPhaseReorder,
    TaskPhaseResponse,
    TimelineResponse,
    TimelineTaskResponse,
    TimelineDayResponse,
    ConflictsResponse,
    ConflictResponse,
    ActivityTemplateCreate,
    ActivityTemplateUpdate,
    ActivityTemplateResponse,
    ActivityTemplateListItem,
    OverdueTemplateResponse,
    TemplateActivityCreate,
    TemplateActivityUpdate,
    TemplateActivityResponse,
    ClientTemplateAssignmentCreate,
    ClientTemplateAssignmentResponse,
    RoutineTypeCreate,
    RoutineTypeUpdate,
    RoutineTypeResponse,
    ClientSLACreate,
    ClientSLAUpdate,
    ClientSLAResponse,
    TaskAttachmentResponse,
    ClientTimelineResponse,
    ClientTimelineTask,
    ClientTimelineStats,
    SLAAlert,
    SLAAlertsResponse,
)
from src.modules.notifications.repository import NotificationRepository
from src.modules.notifications.schemas import NotificationCreate
from src.core.logger import log
from src.core.config import get_settings


class TaskService:
    """Service layer for task operations."""

    def __init__(
        self,
        repository: TaskRepository,
        notification_repo: Optional[NotificationRepository] = None,
    ):
        self.repository = repository
        self.notification_repo = notification_repo

    def _notify(
        self,
        user_id: UUID,
        title: str,
        message: str,
        notif_type: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[UUID] = None,
    ):
        """Send a notification if notification repo is available."""
        if self.notification_repo:
            self.notification_repo.create(
                NotificationCreate(
                    title=title,
                    message=message,
                    type=notif_type,
                    related_entity_type=entity_type,
                    related_entity_id=entity_id,
                ),
                user_id,
            )

    def get_user_tasks(
        self,
        user_id: UUID,
        status: Optional[str] = None,
        process_type: Optional[str] = None,
    ) -> List[TaskResponse]:
        """Get all tasks for a user with optional filters."""
        return self.repository.get_by_user(
            user_id, status_filter=status, process_type_filter=process_type
        )

    def create_task(self, task_data: TaskCreate, user_id: UUID) -> TaskResponse:
        """Create a new task."""
        new_task = self.repository.create(task_data, user_id)
        self._notify(
            user_id,
            "Nova tarefa criada",
            f"A tarefa '{new_task.title}' foi criada.",
            "task_assigned",
            "task",
            new_task.id,
        )
        return new_task

    def update_task(
        self, task_id: UUID, user_id: UUID, task_data: TaskUpdate
    ) -> TaskResponse:
        """Update an existing task."""
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found for user {user_id}")

        old_phase_id = task.phase_id
        old_deadline = task.deadline

        # Get phase names before update for completed_at logic
        phases = self.repository.get_phases_by_user(user_id)
        old_phase_name = None
        if old_phase_id:
            old_p = next((p for p in phases if str(p.id) == str(old_phase_id)), None)
            if old_p:
                old_phase_name = old_p.name

        updated_task = self.repository.update(task, task_data)

        # ── completed_at logic: moving to/from "Concluído" ──
        if task_data.phase_id and task_data.phase_id != old_phase_id:
            new_phase = next(
                (p for p in phases if str(p.id) == str(task_data.phase_id)), None
            )
            if new_phase:
                self._notify(
                    user_id,
                    "Tarefa movida",
                    f"'{updated_task.title}' foi movida para '{new_phase.name}'.",
                    "phase_change",
                    "task",
                    updated_task.id,
                )

                # Moving to "Concluído" → set completed_at
                if new_phase.name == "Concluído":
                    updated_task.completed_at = datetime.now(timezone.utc)
                # Moving from "Concluído" to another phase → clear completed_at
                elif old_phase_name == "Concluído":
                    updated_task.completed_at = None

            self.repository.session.commit()
            self.repository.session.refresh(updated_task)

        if task_data.deadline and task_data.deadline != old_deadline:
            self._notify(
                user_id,
                "Prazo atualizado",
                f"O prazo de '{updated_task.title}' foi alterado.",
                "task_deadline",
                "task",
                updated_task.id,
            )

        return updated_task

    def delete_task(self, task_id: UUID, user_id: UUID) -> None:
        """Delete a task."""
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found for user {user_id}")
        self.repository.delete(task)

    def get_phases(self, user_id: UUID) -> List[TaskPhaseResponse]:
        """Get all phases for a user, creating defaults if none exist."""
        phases = self.repository.get_phases_by_user(user_id)
        if not phases:
            phases = self.repository.create_default_phases(user_id)
        return phases

    def create_phase(
        self, user_id: UUID, phase_data: TaskPhaseCreate
    ) -> TaskPhaseResponse:
        """Create a new custom phase."""
        # Ensure default phases exist
        self.get_phases(user_id)
        return self.repository.create_phase(phase_data, user_id)

    def update_phase(
        self, user_id: UUID, phase_id: UUID, phase_data: TaskPhaseUpdate
    ) -> TaskPhaseResponse:
        """Update an existing phase."""
        phase = self.repository.get_phase_by_id(phase_id, user_id)
        if not phase:
            raise ValueError(f"Phase {phase_id} not found for user {user_id}")
        return self.repository.update_phase(phase, phase_data)

    def delete_phase(self, user_id: UUID, phase_id: UUID) -> None:
        """Delete a phase and migrate its tasks to another phase."""
        phase = self.repository.get_phase_by_id(phase_id, user_id)
        if not phase:
            raise ValueError(f"Phase {phase_id} not found for user {user_id}")

        # Check if this is the last phase
        phase_count = self.repository.count_phases(user_id)
        if phase_count <= 1:
            raise ValueError("Cannot delete the last remaining phase")

        # Find a target phase to migrate tasks to
        phases = self.repository.get_phases_by_user(user_id)
        target_phase = next((p for p in phases if p.id != phase_id), None)
        if target_phase:
            self.repository.migrate_tasks_from_phase(phase_id, target_phase.id)

        self.repository.delete_phase(phase)

    def reorder_phases(
        self, user_id: UUID, phase_orders: TaskPhaseReorder
    ) -> List[TaskPhaseResponse]:
        """Reorder phases based on the provided order."""
        from uuid import UUID as UUIDType

        for item in phase_orders.phases:
            phase_id = item["id"]
            if isinstance(phase_id, str):
                phase_id = UUIDType(phase_id)
            phase = self.repository.get_phase_by_id(phase_id, user_id)
            if phase:
                phase.order = item["order"]
        self.repository.session.commit()
        self.repository.session.flush()

        return self.repository.get_phases_by_user(user_id)

    def get_timeline(
        self,
        user_id: UUID,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> TimelineResponse:
        """Get timeline view of tasks grouped by deadline date."""
        if start_date and end_date:
            tasks = self.repository.get_tasks_in_date_range(
                user_id, start_date, end_date
            )
        else:
            tasks = self.repository.get_by_user(user_id)
            tasks = [t for t in tasks if t.deadline is not None]

        timeline = {}
        for task in tasks:
            if task.deadline is None:
                continue
            date_key = task.deadline.strftime("%Y-%m-%d")
            if date_key not in timeline:
                timeline[date_key] = []
            timeline[date_key].append(
                TimelineTaskResponse(
                    id=task.id,
                    title=task.title,
                    client_id=task.client_id,
                    deadline=task.deadline,
                    time_estimate_minutes=task.time_estimate_minutes,
                    priority=task.priority,
                    process_type=task.process_type,
                    status=task.status,
                )
            )

        timeline_days = []
        for date_str, day_tasks in sorted(timeline.items()):
            total_minutes = sum(t.time_estimate_minutes or 0 for t in day_tasks)
            timeline_days.append(
                TimelineDayResponse(
                    date=date_str,
                    tasks=day_tasks,
                    total_minutes=total_minutes,
                )
            )

        return TimelineResponse(timeline=timeline_days)

    def detect_conflicts(
        self, user_id: UUID, max_minutes_per_day: int = 480
    ) -> ConflictsResponse:
        """Detect scheduling conflicts where total estimated hours exceed threshold."""
        tasks = self.repository.get_tasks_with_deadline(user_id)

        daily_load = {}
        for task in tasks:
            if task.deadline is None:
                continue
            date_key = task.deadline.strftime("%Y-%m-%d")
            if date_key not in daily_load:
                daily_load[date_key] = []
            daily_load[date_key].append(task)

        conflicts = []
        for date_str, day_tasks in sorted(daily_load.items()):
            total_minutes = sum(t.time_estimate_minutes or 0 for t in day_tasks)
            if total_minutes > max_minutes_per_day:
                conflicts.append(
                    ConflictResponse(
                        date=date_str,
                        tasks=[
                            {
                                "id": str(t.id),
                                "title": t.title,
                                "time_estimate_minutes": t.time_estimate_minutes,
                                "deadline": t.deadline.isoformat()
                                if t.deadline
                                else None,
                            }
                            for t in day_tasks
                        ],
                        total_minutes=total_minutes,
                    )
                )

        return ConflictsResponse(conflicts=conflicts)

    # ================================================================
    # Activity Template Service Methods
    # ================================================================

    def _is_template_overdue(self, tmpl) -> bool:
        """Check if a template is overdue based on due_date or recurrence_end_date."""
        if not tmpl.is_active:
            return False
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        due = tmpl.due_date
        if due and due.tzinfo is not None:
            due = due.replace(tzinfo=None)
        end = tmpl.recurrence_end_date
        if end and end.tzinfo is not None:
            end = end.replace(tzinfo=None)
        if due and due < now:
            return True
        if end and end < now:
            return True
        return False

    def _compute_days_overdue(self, tmpl) -> int:
        """Calculate how many days a template is overdue."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        due = tmpl.due_date
        if due and due.tzinfo is not None:
            due = due.replace(tzinfo=None)
        end = tmpl.recurrence_end_date
        if end and end.tzinfo is not None:
            end = end.replace(tzinfo=None)
        if due and due < now:
            return (now - due).days
        if end and end < now:
            return (now - end).days
        return 0

    def get_templates(self, user_id: UUID) -> List[ActivityTemplateListItem]:
        """List all templates for a user with activity count and overdue status."""
        templates = self.repository.get_templates_by_user(user_id)
        result = []
        for tmpl in templates:
            activities = self.repository.get_activities_by_template(tmpl.id)
            # Lookup routine type info
            rt_name = None
            rt_color = None
            if tmpl.routine_type_id:
                rt = self.repository.get_routine_type(tmpl.routine_type_id, user_id)
                if rt:
                    rt_name = rt.name
                    rt_color = rt.color
            result.append(
                ActivityTemplateListItem(
                    id=tmpl.id,
                    name=tmpl.name,
                    description=tmpl.description,
                    process_type=tmpl.process_type,
                    recurrence=tmpl.recurrence,
                    weekday_mask=tmpl.weekday_mask,
                    due_day=tmpl.due_day,
                    due_month=tmpl.due_month,
                    due_days_from_start=tmpl.due_days_from_start,
                    due_date=tmpl.due_date,
                    recurrence_end_date=tmpl.recurrence_end_date,
                    is_active=tmpl.is_active,
                    is_overdue=self._is_template_overdue(tmpl),
                    days_overdue=self._compute_days_overdue(tmpl),
                    activity_count=len(activities),
                    routine_type_id=tmpl.routine_type_id,
                    routine_type_name=rt_name,
                    routine_type_color=rt_color,
                    created_at=tmpl.created_at,
                    updated_at=tmpl.updated_at,
                )
            )
        return result

    def get_overdue_templates(self, user_id: UUID) -> List[OverdueTemplateResponse]:
        """Return only overdue templates for dashboard alerts."""
        templates = self.repository.get_templates_by_user(user_id)
        result = []
        for tmpl in templates:
            if not self._is_template_overdue(tmpl):
                continue
            activities = self.repository.get_activities_by_template(tmpl.id)
            days_overdue = self._compute_days_overdue(tmpl)
            result.append(
                OverdueTemplateResponse(
                    id=tmpl.id,
                    name=tmpl.name,
                    description=tmpl.description,
                    process_type=tmpl.process_type,
                    recurrence=tmpl.recurrence,
                    due_date=tmpl.due_date,
                    recurrence_end_date=tmpl.recurrence_end_date,
                    is_active=tmpl.is_active,
                    days_overdue=days_overdue,
                    activity_count=len(activities),
                )
            )
        return result

    def get_template(
        self, template_id: UUID, user_id: UUID
    ) -> Optional[ActivityTemplateResponse]:
        """Get a single template with all its activities."""
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            return None
        activities = self.repository.get_activities_by_template(template_id)
        rt_name = None
        rt_color = None
        if tmpl.routine_type_id:
            rt = self.repository.get_routine_type(tmpl.routine_type_id, user_id)
            if rt:
                rt_name = rt.name
                rt_color = rt.color
        return ActivityTemplateResponse(
            id=tmpl.id,
            user_id=tmpl.user_id,
            name=tmpl.name,
            description=tmpl.description,
            process_type=tmpl.process_type,
            recurrence=tmpl.recurrence,
            weekday_mask=tmpl.weekday_mask,
            due_day=tmpl.due_day,
            due_month=tmpl.due_month,
            due_days_from_start=tmpl.due_days_from_start,
            due_date=tmpl.due_date,
            recurrence_end_date=tmpl.recurrence_end_date,
            is_active=tmpl.is_active,
            routine_type_id=tmpl.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            created_at=tmpl.created_at,
            updated_at=tmpl.updated_at,
            activities=[TemplateActivityResponse.model_validate(a) for a in activities],
        )

    def create_template(
        self, template_in: ActivityTemplateCreate, user_id: UUID
    ) -> ActivityTemplateResponse:
        tmpl = self.repository.create_template(template_in, user_id)
        log.info(f"📋 Template criado: {tmpl.name} por usuário {user_id}")
        rt_name = None
        rt_color = None
        if tmpl.routine_type_id:
            rt = self.repository.get_routine_type(tmpl.routine_type_id, user_id)
            if rt:
                rt_name = rt.name
                rt_color = rt.color
        return ActivityTemplateResponse(
            id=tmpl.id,
            user_id=tmpl.user_id,
            name=tmpl.name,
            description=tmpl.description,
            process_type=tmpl.process_type,
            recurrence=tmpl.recurrence,
            weekday_mask=tmpl.weekday_mask,
            due_day=tmpl.due_day,
            due_month=tmpl.due_month,
            due_days_from_start=tmpl.due_days_from_start,
            due_date=tmpl.due_date,
            recurrence_end_date=tmpl.recurrence_end_date,
            is_active=tmpl.is_active,
            routine_type_id=tmpl.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            created_at=tmpl.created_at,
            updated_at=tmpl.updated_at,
            activities=[],
        )

    def update_template(
        self, template_id: UUID, user_id: UUID, template_in: ActivityTemplateUpdate
    ) -> ActivityTemplateResponse:
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        updated = self.repository.update_template(tmpl, template_in)
        activities = self.repository.get_activities_by_template(template_id)
        rt_name = None
        rt_color = None
        if updated.routine_type_id:
            rt = self.repository.get_routine_type(updated.routine_type_id, user_id)
            if rt:
                rt_name = rt.name
                rt_color = rt.color
        return ActivityTemplateResponse(
            id=updated.id,
            user_id=updated.user_id,
            name=updated.name,
            description=updated.description,
            process_type=updated.process_type,
            recurrence=updated.recurrence,
            weekday_mask=updated.weekday_mask,
            due_day=updated.due_day,
            due_month=updated.due_month,
            due_days_from_start=updated.due_days_from_start,
            due_date=updated.due_date,
            recurrence_end_date=updated.recurrence_end_date,
            is_active=updated.is_active,
            routine_type_id=updated.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            created_at=updated.created_at,
            updated_at=updated.updated_at,
            activities=[TemplateActivityResponse.model_validate(a) for a in activities],
        )

    def delete_template(self, template_id: UUID, user_id: UUID) -> None:
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        self.repository.delete_template(tmpl)
        log.info(f"🗑️ Template excluído: {template_id}")

    # ── Template Activities ──

    def create_activity(
        self, template_id: UUID, user_id: UUID, activity_in: TemplateActivityCreate
    ) -> TemplateActivityResponse:
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        act = self.repository.create_activity(template_id, activity_in)
        return TemplateActivityResponse.model_validate(act)

    def update_activity(
        self,
        template_id: UUID,
        activity_id: UUID,
        user_id: UUID,
        activity_in: TemplateActivityUpdate,
    ) -> TemplateActivityResponse:
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        act = self.repository.get_activity_by_id(activity_id)
        if not act or str(act.template_id) != str(template_id):
            raise ValueError(
                f"Activity {activity_id} not found in template {template_id}"
            )
        updated = self.repository.update_activity(act, activity_in)
        return TemplateActivityResponse.model_validate(updated)

    def delete_activity(
        self, template_id: UUID, activity_id: UUID, user_id: UUID
    ) -> None:
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        act = self.repository.get_activity_by_id(activity_id)
        if not act or str(act.template_id) != str(template_id):
            raise ValueError(
                f"Activity {activity_id} not found in template {template_id}"
            )
        self.repository.delete_activity(act)

    def reorder_activities(
        self, template_id: UUID, user_id: UUID, ordered_ids: list[UUID]
    ) -> List[TemplateActivityResponse]:
        tmpl = self.repository.get_template_by_id(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        self.repository.reorder_activities(template_id, ordered_ids)
        activities = self.repository.get_activities_by_template(template_id)
        return [TemplateActivityResponse.model_validate(a) for a in activities]

    # ================================================================
    # Client Template Assignment + Auto-generation
    # ================================================================

    def assign_template_to_client(
        self, assignment_in: ClientTemplateAssignmentCreate, user_id: UUID
    ) -> dict:
        """Assign a template to a client and auto-generate tasks."""
        # Validate template exists
        tmpl = self.repository.get_template_by_id(assignment_in.template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {assignment_in.template_id} not found")

        # Create assignment
        assignment = self.repository.create_assignment(assignment_in, user_id)

        # Get template activities
        activities = self.repository.get_activities_by_template(
            assignment_in.template_id
        )

        # Get first phase ("A Fazer") for default
        phases = self.repository.get_phases_by_user(user_id)
        first_phase = phases[0] if phases else None

        # Generate tasks for each activity
        generated_tasks = []

        if tmpl.recurrence == "weekly":
            # Weekly: generate tasks for all remaining marked weekdays in the current month
            for act in activities:
                weekly_deadlines = self._get_weekly_deadlines_for_month(tmpl)
                for deadline in weekly_deadlines:
                    if self.repository.has_pending_task(
                        assignment.id, act.name, deadline
                    ):
                        continue
                    instance_id = build_routine_instance_id(
                        assignment.id,
                        act.name,
                        deadline.strftime("%Y-%m-%d"),
                    )
                    task_data = TaskCreate(
                        title=act.name,
                        description=act.description,
                        client_id=assignment_in.client_id,
                        status="todo",
                        priority="medium",
                        process_type=tmpl.process_type,
                        deadline=deadline,
                        time_estimate_minutes=act.estimated_minutes,
                        template_id=assignment_in.template_id,
                        assignment_id=assignment.id,
                        routine_instance_id=instance_id,
                    )
                    task = self.repository.create(task_data, user_id)
                    if first_phase:
                        task.phase_id = first_phase.id
                    generated_tasks.append(task)

        elif tmpl.recurrence == "daily":
            # Daily: only generate on weekdays, using the same deadline calculation
            now = datetime.now(timezone.utc)
            if now.weekday() < 5:
                deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
                daily_deadline = next_business_day(deadline)

                for act in activities:
                    if self.repository.has_pending_task(
                        assignment.id, act.name, daily_deadline
                    ):
                        continue
                    instance_id = build_routine_instance_id(
                        assignment.id,
                        act.name,
                        daily_deadline.strftime("%Y-%m-%d"),
                    )
                    task_data = TaskCreate(
                        title=act.name,
                        description=act.description,
                        client_id=assignment_in.client_id,
                        status="todo",
                        priority="medium",
                        process_type=tmpl.process_type,
                        deadline=daily_deadline,
                        time_estimate_minutes=act.estimated_minutes,
                        template_id=assignment_in.template_id,
                        assignment_id=assignment.id,
                        routine_instance_id=instance_id,
                    )
                    task = self.repository.create(task_data, user_id)
                    if first_phase:
                        task.phase_id = first_phase.id
                    generated_tasks.append(task)

        else:
            # Default: one task per activity at the calculated deadline
            # (used by monthly, yearly, once)
            for act in activities:
                deadline = self._calculate_activity_deadline(
                    act, assignment.start_date, tmpl
                )
                # Build routine_instance_id based on recurrence type
                if tmpl.recurrence == "monthly":
                    period_key = deadline.strftime("%Y-%m")
                elif tmpl.recurrence in ("yearly", "annual"):
                    period_key = str(deadline.year)
                else:
                    period_key = deadline.strftime("%Y-%m-%d")
                instance_id = build_routine_instance_id(
                    assignment.id,
                    act.name,
                    period_key,
                )
                task_data = TaskCreate(
                    title=act.name,
                    description=act.description,
                    client_id=assignment_in.client_id,
                    status="todo",
                    priority="medium",
                    process_type=tmpl.process_type,
                    deadline=deadline,
                    time_estimate_minutes=act.estimated_minutes,
                    template_id=assignment_in.template_id,
                    assignment_id=assignment.id,
                    routine_instance_id=instance_id,
                )
                task = self.repository.create(task_data, user_id)
                if first_phase:
                    task.phase_id = first_phase.id
                generated_tasks.append(task)

        if generated_tasks:
            self.repository.session.commit()
            for t in generated_tasks:
                self.repository.session.refresh(t)

        log.info(
            f"🚀 Template '{tmpl.name}' vinculado ao cliente {assignment_in.client_id} — "
            f"{len(generated_tasks)} tarefas geradas"
        )

        return {
            "assignment_id": str(assignment.id),
            "tasks_generated": len(generated_tasks),
            "template_name": tmpl.name,
        }

    def _get_effective_due_day(
        self, activity: TemplateActivityModel, tmpl: Optional[ActivityTemplate] = None
    ) -> Optional[int]:
        return get_effective_due_day(activity, tmpl)

    def _get_weekly_deadlines_for_month(self, tmpl: ActivityTemplate) -> list[datetime]:
        return get_weekly_deadlines_for_month(tmpl)

    def _calculate_activity_deadline(
        self,
        activity: TemplateActivityModel,
        start_date: Optional[datetime] = None,
        tmpl: Optional[ActivityTemplate] = None,
    ) -> datetime:
        return calculate_activity_deadline(activity, start_date, tmpl)

    def get_client_assignments(
        self, client_id: UUID
    ) -> List[ClientTemplateAssignmentResponse]:
        assignments = self.repository.get_assignments_by_client(client_id)
        return [ClientTemplateAssignmentResponse.model_validate(a) for a in assignments]

    def remove_client_assignment(self, assignment_id: UUID, user_id: UUID) -> None:
        assignment = self.repository.get_assignment_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")
        self.repository.delete_assignment(assignment)

    def regenerate_client_tasks(self, assignment_id: UUID, user_id: UUID) -> dict:
        """Regenerate tasks for a client assignment (next period)."""
        assignment = self.repository.get_assignment_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        activities = self.repository.get_activities_by_template(assignment.template_id)
        tmpl = self.repository.get_template_by_id(assignment.template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {assignment.template_id} not found")

        phases = self.repository.get_phases_by_user(user_id)
        first_phase = phases[0] if phases else None

        generated = 0
        for act in activities:
            deadline = self._calculate_activity_deadline(
                act, datetime.now(timezone.utc), tmpl
            )
            task_data = TaskCreate(
                title=act.name,
                description=act.description,
                client_id=assignment.client_id,
                status="todo",
                priority="medium",
                process_type=tmpl.process_type,
                deadline=deadline,
                time_estimate_minutes=act.estimated_minutes,
                template_id=assignment.template_id,
                assignment_id=assignment.id,
            )
            task = self.repository.create(task_data, user_id)
            if first_phase:
                task.phase_id = first_phase.id
            generated += 1

        if generated:
            self.repository.session.commit()

        return {"tasks_generated": generated}

    # ================================================================
    # RoutineType Service Methods
    # ================================================================

    def create_routine_type(
        self, user_id: UUID, data: RoutineTypeCreate
    ) -> RoutineTypeResponse:
        obj = self.repository.create_routine_type(user_id, data)
        log.info(f"🏷️ Tipo de rotina criado: {obj.name} (user={user_id})")
        return RoutineTypeResponse.model_validate(obj)

    def list_routine_types(self, user_id: UUID) -> List[RoutineTypeResponse]:
        objs = self.repository.list_routine_types(user_id)
        return [RoutineTypeResponse.model_validate(o) for o in objs]

    def get_routine_type(self, type_id: UUID, user_id: UUID) -> RoutineTypeResponse:
        obj = self.repository.get_routine_type(type_id, user_id)
        if not obj:
            raise ValueError(f"RoutineType {type_id} not found")
        return RoutineTypeResponse.model_validate(obj)

    def update_routine_type(
        self, type_id: UUID, user_id: UUID, data: RoutineTypeUpdate
    ) -> RoutineTypeResponse:
        obj = self.repository.update_routine_type(type_id, user_id, data)
        if not obj:
            raise ValueError(f"RoutineType {type_id} not found")
        return RoutineTypeResponse.model_validate(obj)

    def delete_routine_type(self, type_id: UUID, user_id: UUID) -> None:
        if not self.repository.delete_routine_type(type_id, user_id):
            raise ValueError(f"RoutineType {type_id} not found")
        log.info(f"🗑️ Tipo de rotina removido: {type_id}")

    # ================================================================
    # SLA Service Methods
    # ================================================================

    def get_client_slas(self, client_id: UUID) -> List[ClientSLAResponse]:
        slas = self.repository.get_slas_by_client(client_id)
        return [ClientSLAResponse.model_validate(s) for s in slas]

    def create_sla(self, sla_in: ClientSLACreate, user_id: UUID) -> ClientSLAResponse:
        sla = self.repository.create_sla(sla_in, user_id)
        log.info(
            f"⏱️ SLA criado: cliente {sla_in.client_id} / {sla_in.process_type} = {sla_in.sla_days}d"
        )
        return ClientSLAResponse.model_validate(sla)

    def update_sla(
        self, sla_id: UUID, user_id: UUID, sla_in: ClientSLAUpdate
    ) -> ClientSLAResponse:
        sla = self.repository.get_sla_by_id(sla_id)
        if not sla:
            raise ValueError(f"SLA {sla_id} not found")
        updated = self.repository.update_sla(sla, sla_in)
        return ClientSLAResponse.model_validate(updated)

    def delete_sla(self, sla_id: UUID) -> None:
        sla = self.repository.get_sla_by_id(sla_id)
        if not sla:
            raise ValueError(f"SLA {sla_id} not found")
        self.repository.delete_sla(sla)

    def _calculate_sla_status(self, task, slas: List) -> tuple:
        """Calculate SLA status for a single task.
        Returns (sla_status: str, days_used: int, days_limit: int).
        """
        if not task.deadline:
            return "on_time", None, None

        # Check if task is in a "done" phase
        is_done = False
        if task.phase_id:
            phases = self.repository.get_phases_by_user(task.user_id)
            for phase in phases:
                if str(phase.id) == str(task.phase_id) and phase.name == "Concluído":
                    is_done = True
                    break

        if task.status == "done":
            is_done = True

        now = datetime.now(timezone.utc)
        deadline = task.deadline

        # Find matching SLA
        sla_config = None
        if task.process_type:
            sla_config = self.repository.get_sla_by_client_and_process(
                task.client_id, task.process_type
            )

        if not sla_config:
            return "on_time", None, None

        sla_limit = sla_config.sla_days
        warning_at = sla_limit * sla_config.warning_threshold

        # Calculate days used
        if is_done:
            days_used = 0  # completed, no issue
        else:
            days_remaining = (deadline - now).total_seconds() / 86400
            days_used = sla_limit - days_remaining

        if is_done:
            return "on_time", 0, sla_limit
        elif days_remaining < 0:
            return "overdue", abs(days_remaining), sla_limit
        elif days_remaining <= (sla_limit - warning_at):
            return "warning", days_used, sla_limit
        else:
            return "on_time", days_used, sla_limit

    # ================================================================
    # Client Timeline
    # ================================================================

    def get_client_timeline(
        self, client_id: UUID, user_id: UUID, month: Optional[str] = None
    ) -> ClientTimelineResponse:
        """Get timeline for a specific client, month, with SLA status."""
        from src.modules.clients.repository import ClientRepository

        client_repo = ClientRepository(self.repository.session)
        client = client_repo.get_by_id(client_id, user_id)
        if not client:
            raise ValueError(f"Client {client_id} not found")

        # Parse month or use current
        if month and len(month) == 7:
            year, mon = int(month.split("-")[0]), int(month.split("-")[1])
        else:
            now = datetime.now(timezone.utc)
            year, mon = now.year, now.month

        start_date = datetime(year, mon, 1, tzinfo=timezone.utc)
        if mon == 12:
            end_date = datetime(year + 1, 1, 1, tzinfo=timezone.utc) - timedelta(
                seconds=1
            )
        else:
            end_date = datetime(year, mon + 1, 1, tzinfo=timezone.utc) - timedelta(
                seconds=1
            )

        tasks = self.repository.get_tasks_by_client_and_month(
            client_id, start_date, end_date
        )

        # Get SLA configs for this client
        slas = self.repository.get_slas_by_client(client_id)
        sla_list = [
            {
                "process_type": s.process_type,
                "sla_days": s.sla_days,
                "warning_threshold": s.warning_threshold,
            }
            for s in slas
        ]

        stats = ClientTimelineStats()
        timeline_tasks = []

        for task in tasks:
            sla_status, days_used, days_limit = self._calculate_sla_status(task, slas)
            attachment_count = (
                len(task.attachments) if hasattr(task, "attachments") else 0
            )

            t = ClientTimelineTask(
                id=task.id,
                title=task.title,
                description=task.description,
                phase_id=task.phase_id,
                status=task.status,
                priority=task.priority,
                process_type=task.process_type,
                deadline=task.deadline,
                time_estimate_minutes=task.time_estimate_minutes,
                sla_status=sla_status,
                sla_days_used=int(days_used) if days_used is not None else None,
                sla_days_limit=days_limit,
                attachment_count=attachment_count,
                created_at=task.created_at,
                updated_at=task.updated_at,
            )
            timeline_tasks.append(t)

            # Update stats
            stats.total += 1
            if sla_status == "overdue":
                stats.overdue += 1
            elif sla_status == "warning":
                stats.warning += 1
            else:
                stats.on_time += 1

            if task.status == "done" or (
                task.phase_id
                and any(
                    p.name == "Concluído"
                    for p in self.repository.get_phases_by_user(user_id)
                    if str(p.id) == str(task.phase_id)
                )
            ):
                stats.completed += 1
            else:
                stats.in_progress += 1

        month_str = f"{year:04d}-{mon:02d}"
        return ClientTimelineResponse(
            client_id=client_id,
            client_name=client.name,
            client_email=getattr(client, "email", None),
            month=month_str,
            stats=stats,
            slas=sla_list,
            tasks=timeline_tasks,
        )

    # ================================================================
    # Task Attachments
    # ================================================================

    def get_task_attachments(
        self, task_id: UUID, user_id: UUID
    ) -> List[TaskAttachmentResponse]:
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        attachments = self.repository.get_attachments_by_task(task_id)
        return [TaskAttachmentResponse.model_validate(a) for a in attachments]

    def upload_attachment(
        self,
        task_id: UUID,
        user_id: UUID,
        file_name: str,
        file_path: str,
        file_size: Optional[int],
        content_type: Optional[str],
    ) -> TaskAttachmentResponse:
        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        att = self.repository.create_attachment(
            task_id=task_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            content_type=content_type,
            uploaded_by=user_id,
        )
        log.info(f"📎 Anexo adicionado à tarefa {task_id}: {file_name}")
        return TaskAttachmentResponse.model_validate(att)

    def delete_attachment(self, attachment_id: UUID, user_id: UUID) -> None:
        att = self.repository.get_attachment_by_id(attachment_id)
        if not att:
            raise ValueError(f"Attachment {attachment_id} not found")
        # Verify task ownership
        task = self.repository.get_by_id(att.task_id, user_id)
        if not task:
            raise ValueError(f"Task {att.task_id} not found for user")
        # Delete file from disk
        import os

        if os.path.exists(att.file_path):
            os.remove(att.file_path)
        self.repository.delete_attachment(att)

    # ================================================================
    # Email Sending
    # ================================================================

    def send_task_email(
        self,
        task_id: UUID,
        user_id: UUID,
        subject: str,
        body: str,
        attachment_ids: List[UUID],
    ) -> dict:
        """Send an email with task attachments to the client."""
        from src.modules.clients.repository import ClientRepository

        task = self.repository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        # Get client info
        client_repo = ClientRepository(self.repository.session)
        client = client_repo.get_by_id(task.client_id, user_id)
        if not client:
            raise ValueError(f"Client {task.client_id} not found")

        client_email = getattr(client, "email", None)
        if not client_email:
            raise ValueError(f"Client {task.client_id} has no email configured")

        # Get requested attachments
        attachments = []
        for att_id in attachment_ids:
            att = self.repository.get_attachment_by_id(att_id)
            if att and str(att.task_id) == str(task_id):
                attachments.append(att)

        # Send email
        settings = get_settings()
        success = self._send_email_smtp(
            to_email=client_email,
            subject=subject or f"Entrega: {task.title}",
            body=body or f"Segue anexo referente à tarefa: {task.title}",
            attachments=attachments,
            smtp_host=getattr(settings, "smtp_host", None),
            smtp_port=getattr(settings, "smtp_port", 587),
            smtp_user=getattr(settings, "smtp_user", None),
            smtp_pass=getattr(settings, "smtp_password", None),
            from_email=getattr(settings, "smtp_from_email", None),
        )

        if not success:
            raise RuntimeError(
                "Falha ao enviar email. Verifique as configurações de SMTP."
            )

        # Mark attachments as sent
        sent_count = 0
        for att in attachments:
            self.repository.mark_attachment_sent(att)
            sent_count += 1

        # Create notification
        self._notify(
            user_id,
            "Email enviado",
            f"Arquivo(s) enviado(s) para {client.name} ({client_email})",
            "email_sent",
            "task",
            task_id,
        )

        log.info(f"📧 Email enviado para {client_email} — {len(attachments)} anexo(s)")

        return {
            "success": True,
            "to": client_email,
            "client_name": client.name,
            "attachments_sent": sent_count,
        }

    def _send_email_smtp(
        self,
        to_email: str,
        subject: str,
        body: str,
        attachments: list,
        smtp_host: Optional[str],
        smtp_port: int,
        smtp_user: Optional[str],
        smtp_pass: Optional[str],
        from_email: Optional[str],
    ) -> bool:
        """Send email via SMTP. Returns True if successful."""
        import smtplib
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.base import MIMEBase
        from email import encoders

        if not smtp_host:
            log.warning("⚠️ SMTP não configurado. Email não enviado.")
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = from_email or smtp_user or "noreply@cafecombpo.com.br"
            msg["To"] = to_email
            msg["Subject"] = subject

            msg.attach(MIMEText(body, "plain", "utf-8"))

            for att in attachments:
                try:
                    with open(att.file_path, "rb") as f:
                        part = MIMEBase("application", "octet-stream")
                        part.set_payload(f.read())
                        encoders.encode_base64(part)
                        part.add_header(
                            "Content-Disposition",
                            f"attachment; filename={att.file_name}",
                        )
                        msg.attach(part)
                except FileNotFoundError:
                    log.warning(f"Arquivo não encontrado: {att.file_path}")
                    continue

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                if smtp_user and smtp_pass:
                    server.login(smtp_user, smtp_pass)
                server.send_message(msg)

            return True
        except Exception as e:
            log.error(f"❌ Falha ao enviar email: {e}")
            return False

    # ================================================================
    # Dashboard SLA Alerts
    # ================================================================

    def get_sla_alerts(self, user_id: UUID) -> SLAAlertsResponse:
        """Get SLA alerts for the dashboard."""
        from src.modules.clients.repository import ClientRepository

        client_repo = ClientRepository(self.repository.session)

        overdue_tasks = self.repository.get_tasks_overdue(user_id)
        warning_tasks = self.repository.get_tasks_near_deadline(user_id, days_ahead=2)

        # Group overdue by client
        overdue_by_client = {}
        for task in overdue_tasks:
            cid = str(task.client_id)
            if cid not in overdue_by_client:
                overdue_by_client[cid] = []
            overdue_by_client[cid].append(task)

        overdue_alerts = []
        for cid, tasks in overdue_by_client.items():
            client = client_repo.get_by_id(UUID(cid), user_id)
            client_name = client.name if client else "Cliente"
            total_days = sum(
                (datetime.now(timezone.utc) - t.deadline).days
                for t in tasks
                if t.deadline
            )
            overdue_alerts.append(
                SLAAlert(
                    type="overdue",
                    message=f"{len(tasks)} tarefa(s) atrasada(s) — {client_name} (Total: {total_days}d em atraso)",
                    count=len(tasks),
                    tasks=[
                        {"id": str(t.id), "title": t.title, "client_name": client_name}
                        for t in tasks
                    ],
                )
            )

        # Group warning by client
        warning_by_client = {}
        for task in warning_tasks:
            cid = str(task.client_id)
            if cid not in warning_by_client:
                warning_by_client[cid] = []
            warning_by_client[cid].append(task)

        warning_alerts = []
        for cid, tasks in warning_by_client.items():
            client = client_repo.get_by_id(UUID(cid), user_id)
            client_name = client.name if client else "Cliente"
            warning_alerts.append(
                SLAAlert(
                    type="warning",
                    message=f"{len(tasks)} tarefa(s) próxima(s) do vencimento — {client_name}",
                    count=len(tasks),
                    tasks=[
                        {"id": str(t.id), "title": t.title, "client_name": client_name}
                        for t in tasks
                    ],
                )
            )

        return SLAAlertsResponse(
            overdue=overdue_alerts,
            warning=warning_alerts,
            total_overdue=len(overdue_tasks),
            total_warning=len(warning_tasks),
        )
