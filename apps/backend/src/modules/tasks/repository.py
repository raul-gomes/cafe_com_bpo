from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from .models import (
    Task,
    TaskPhase,
    ActivityTemplate,
    TemplateActivity,
    ClientTemplateAssignment,
    ClientSLA,
    TaskAttachment,
    RoutineType,
)
from .schemas import (
    TaskCreate,
    TaskUpdate,
    TaskPhaseCreate,
    TaskPhaseUpdate,
    ActivityTemplateCreate,
    ActivityTemplateUpdate,
    TemplateActivityCreate,
    TemplateActivityUpdate,
    ClientTemplateAssignmentCreate,
    RoutineTypeCreate,
    RoutineTypeUpdate,
    ClientSLACreate,
    ClientSLAUpdate,
)


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, task_id: UUID, user_id: UUID) -> Optional[Task]:
        return (
            self.session.query(Task)
            .filter(Task.id == task_id, Task.user_id == user_id)
            .first()
        )

    def get_by_user(
        self,
        user_id: UUID,
        status_filter: Optional[str] = None,
        process_type_filter: Optional[str] = None,
    ) -> List[Task]:
        query = self.session.query(Task).filter(
            Task.user_id == user_id, Task.deleted_at.is_(None)
        )
        if status_filter:
            query = query.filter(Task.status == status_filter)
        if process_type_filter:
            query = query.filter(Task.process_type == process_type_filter)
        return query.order_by(Task.deadline.asc().nullslast()).all()

    def create(self, task_in: TaskCreate, user_id: UUID) -> Task:
        task_data = task_in.model_dump()
        new_task = Task(**task_data, user_id=user_id)
        self.session.add(new_task)
        self.session.commit()
        self.session.refresh(new_task)
        return new_task

    def update(self, task: Task, task_in: TaskUpdate) -> Task:
        update_data = task_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)
        self.session.commit()
        self.session.refresh(task)
        return task

    def delete(self, task: Task) -> None:
        task.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def cancel(self, task: Task) -> Task:
        """Mark a task as cancelled by setting cancelled_at timestamp."""
        if task.cancelled_at is None:
            task.cancelled_at = datetime.now(timezone.utc)
            task.status = "cancelled"
            self.session.commit()
            self.session.refresh(task)
        return task

    def get_phases_by_user(self, user_id: UUID) -> List[TaskPhase]:
        """Get all phases for a user, ordered by order field."""
        return (
            self.session.query(TaskPhase)
            .filter(TaskPhase.user_id == user_id)
            .order_by(TaskPhase.order.asc())
            .all()
        )

    def get_phase_by_id(self, phase_id: UUID, user_id: UUID) -> Optional[TaskPhase]:
        """Get a specific phase for a user."""
        return (
            self.session.query(TaskPhase)
            .filter(TaskPhase.id == phase_id, TaskPhase.user_id == user_id)
            .first()
        )

    def create_phase(self, phase_in: TaskPhaseCreate, user_id: UUID) -> TaskPhase:
        """Create a new custom phase."""
        phase_data = phase_in.model_dump()
        new_phase = TaskPhase(**phase_data, user_id=user_id, is_default=False)
        self.session.add(new_phase)
        self.session.commit()
        self.session.refresh(new_phase)
        return new_phase

    def update_phase(self, phase: TaskPhase, phase_in: TaskPhaseUpdate) -> TaskPhase:
        """Update a phase."""
        update_data = phase_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(phase, field, value)
        self.session.commit()
        self.session.refresh(phase)
        return phase

    def delete_phase(self, phase: TaskPhase) -> None:
        """Delete a phase."""
        self.session.delete(phase)
        self.session.commit()

    def create_default_phases(self, user_id: UUID) -> List[TaskPhase]:
        """Create the 3 default phases for a new user."""
        from .models import DEFAULT_PHASES

        phases = []
        for phase_data in DEFAULT_PHASES:
            phase = TaskPhase(
                user_id=user_id,
                name=phase_data["name"],
                color=phase_data["color"],
                order=phase_data["order"],
                is_default=True,
            )
            self.session.add(phase)
            phases.append(phase)
        self.session.commit()
        for p in phases:
            self.session.refresh(p)
        return phases

    def count_phases(self, user_id: UUID) -> int:
        """Count phases for a user."""
        return (
            self.session.query(TaskPhase).filter(TaskPhase.user_id == user_id).count()
        )

    def get_tasks_for_phase(self, phase_id: UUID, user_id: UUID) -> List[Task]:
        """Get all tasks in a specific phase."""
        return (
            self.session.query(Task)
            .filter(
                Task.phase_id == phase_id,
                Task.user_id == user_id,
                Task.deleted_at.is_(None),
            )
            .order_by(Task.deadline.asc().nullslast())
            .all()
        )

    def migrate_tasks_from_phase(
        self, old_phase_id: UUID, new_phase_id: Optional[UUID]
    ) -> int:
        """Migrate all tasks from one phase to another. Returns count of migrated tasks."""
        tasks = self.session.query(Task).filter(Task.phase_id == old_phase_id).all()
        count = len(tasks)
        for task in tasks:
            task.phase_id = new_phase_id
        self.session.commit()
        return count

    def get_tasks_in_date_range(
        self, user_id: UUID, start_date: datetime, end_date: datetime
    ) -> List[Task]:
        """Get all tasks within a date range."""
        return (
            self.session.query(Task)
            .filter(
                Task.user_id == user_id,
                Task.deleted_at.is_(None),
                Task.deadline >= start_date,
                Task.deadline <= end_date,
            )
            .order_by(Task.deadline.asc())
            .all()
        )

    def get_tasks_with_deadline(self, user_id: UUID) -> List[Task]:
        """Get all tasks that have a deadline set."""
        return (
            self.session.query(Task)
            .filter(
                Task.user_id == user_id,
                Task.deleted_at.is_(None),
                Task.deadline.isnot(None),
            )
            .order_by(Task.deadline.asc())
            .all()
        )

    # ──────────────────────────────────────────────
    # ActivityTemplate
    # ──────────────────────────────────────────────

    def get_templates_by_user(self, user_id: UUID) -> List[ActivityTemplate]:
        return (
            self.session.query(ActivityTemplate)
            .filter(ActivityTemplate.user_id == user_id)
            .order_by(ActivityTemplate.created_at.desc())
            .all()
        )

    def get_template_by_id(
        self, template_id: UUID, user_id: UUID
    ) -> Optional[ActivityTemplate]:
        return (
            self.session.query(ActivityTemplate)
            .filter(
                ActivityTemplate.id == template_id, ActivityTemplate.user_id == user_id
            )
            .first()
        )

    def create_template(
        self, template_in: ActivityTemplateCreate, user_id: UUID
    ) -> ActivityTemplate:
        data = template_in.model_dump()
        tmpl = ActivityTemplate(**data, user_id=user_id)
        self.session.add(tmpl)
        self.session.commit()
        self.session.refresh(tmpl)
        return tmpl

    def update_template(
        self, template: ActivityTemplate, template_in: ActivityTemplateUpdate
    ) -> ActivityTemplate:
        data = template_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(template, field, value)
        self.session.commit()
        self.session.refresh(template)
        return template

    def delete_template(self, template: ActivityTemplate) -> None:
        self.session.delete(template)
        self.session.commit()

    # ──────────────────────────────────────────────
    # TemplateActivity
    # ──────────────────────────────────────────────

    def get_activities_by_template(self, template_id: UUID) -> List[TemplateActivity]:
        return (
            self.session.query(TemplateActivity)
            .filter(TemplateActivity.template_id == template_id)
            .order_by(TemplateActivity.order.asc())
            .all()
        )

    def get_activity_by_id(self, activity_id: UUID) -> Optional[TemplateActivity]:
        return (
            self.session.query(TemplateActivity)
            .filter(TemplateActivity.id == activity_id)
            .first()
        )

    def create_activity(
        self, template_id: UUID, activity_in: TemplateActivityCreate
    ) -> TemplateActivity:
        data = activity_in.model_dump()
        act = TemplateActivity(**data, template_id=template_id)
        self.session.add(act)
        self.session.commit()
        self.session.refresh(act)
        return act

    def update_activity(
        self, activity: TemplateActivity, activity_in: TemplateActivityUpdate
    ) -> TemplateActivity:
        data = activity_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(activity, field, value)
        self.session.commit()
        self.session.refresh(activity)
        return activity

    def delete_activity(self, activity: TemplateActivity) -> None:
        self.session.delete(activity)
        self.session.commit()

    def reorder_activities(self, template_id: UUID, ordered_ids: list[UUID]) -> None:
        activities = self.get_activities_by_template(template_id)
        id_map = {str(a.id): a for a in activities}
        for idx, act_id in enumerate(ordered_ids):
            act = id_map.get(str(act_id))
            if act:
                act.order = idx
        self.session.commit()

    # ──────────────────────────────────────────────
    # ClientTemplateAssignment
    # ──────────────────────────────────────────────

    def get_assignments_by_client(
        self, client_id: UUID
    ) -> List[ClientTemplateAssignment]:
        return (
            self.session.query(ClientTemplateAssignment)
            .filter(ClientTemplateAssignment.client_id == client_id)
            .all()
        )

    def get_assignment_by_id(
        self, assignment_id: UUID
    ) -> Optional[ClientTemplateAssignment]:
        return (
            self.session.query(ClientTemplateAssignment)
            .filter(ClientTemplateAssignment.id == assignment_id)
            .first()
        )

    def create_assignment(
        self, assignment_in: ClientTemplateAssignmentCreate, user_id: UUID
    ) -> ClientTemplateAssignment:
        data = assignment_in.model_dump()
        assignment = ClientTemplateAssignment(**data, user_id=user_id)
        self.session.add(assignment)
        self.session.commit()
        self.session.refresh(assignment)
        return assignment

    def delete_assignment(self, assignment: ClientTemplateAssignment) -> None:
        self.session.delete(assignment)
        self.session.commit()

    def get_assignments_by_user(self, user_id: UUID) -> List[ClientTemplateAssignment]:
        return (
            self.session.query(ClientTemplateAssignment)
            .filter(ClientTemplateAssignment.user_id == user_id)
            .all()
        )

    def get_active_assignments(self) -> List[ClientTemplateAssignment]:
        all_assignments = self.session.query(ClientTemplateAssignment).all()
        return [a for a in all_assignments if a.is_active is True]

    def get_tasks_by_assignment_and_deadline(
        self, assignment_id: UUID, deadline_start: datetime, deadline_end: datetime
    ) -> List[Task]:
        """Get tasks for an assignment with deadline in a given range."""
        return (
            self.session.query(Task)
            .filter(
                Task.assignment_id == assignment_id,
                Task.deadline >= deadline_start,
                Task.deadline <= deadline_end,
                Task.deleted_at.is_(None),
            )
            .all()
        )

    def has_pending_task_for_deadline(
        self, assignment_id: UUID, deadline: datetime
    ) -> bool:
        """Check if there is a pending (not done/cancelled) task for this assignment on a given deadline."""
        from src.modules.tasks.models import Task as TaskModel

        deadline_start = deadline.replace(hour=0, minute=0, second=0, microsecond=0)
        deadline_end = deadline.replace(hour=23, minute=59, second=59, microsecond=999999)
        existing = (
            self.session.query(TaskModel.id)
            .filter(
                TaskModel.assignment_id == assignment_id,
                TaskModel.deadline >= deadline_start,
                TaskModel.deadline <= deadline_end,
                TaskModel.deleted_at.is_(None),
                TaskModel.status.notin_(["done", "cancelled"]),
            )
            .first()
        )
        return existing is not None

    def update_assignment_last_generated(
        self, assignment_id: UUID, timestamp: Optional[datetime] = None
    ) -> None:
        """Update last_generated_at on an assignment."""
        assignment = self.get_assignment_by_id(assignment_id)
        if assignment:
            assignment.last_generated_at = timestamp or datetime.now(timezone.utc)
            self.session.commit()

    # ──────────────────────────────────────────────
    # ClientSLA
    # ──────────────────────────────────────────────

    def get_slas_by_client(self, client_id: UUID) -> List[ClientSLA]:
        return (
            self.session.query(ClientSLA).filter(ClientSLA.client_id == client_id).all()
        )

    def get_sla_by_id(self, sla_id: UUID) -> Optional[ClientSLA]:
        return self.session.query(ClientSLA).filter(ClientSLA.id == sla_id).first()

    def get_sla_by_client_and_process(
        self, client_id: UUID, process_type: str
    ) -> Optional[ClientSLA]:
        return (
            self.session.query(ClientSLA)
            .filter(
                ClientSLA.client_id == client_id, ClientSLA.process_type == process_type
            )
            .first()
        )

    def create_sla(self, sla_in: ClientSLACreate, user_id: UUID) -> ClientSLA:
        data = sla_in.model_dump()
        sla = ClientSLA(**data, user_id=user_id)
        self.session.add(sla)
        self.session.commit()
        self.session.refresh(sla)
        return sla

    def update_sla(self, sla: ClientSLA, sla_in: ClientSLAUpdate) -> ClientSLA:
        data = sla_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(sla, field, value)
        self.session.commit()
        self.session.refresh(sla)
        return sla

    def delete_sla(self, sla: ClientSLA) -> None:
        self.session.delete(sla)
        self.session.commit()

    # ──────────────────────────────────────────────
    # TaskAttachment
    # ──────────────────────────────────────────────

    def get_attachments_by_task(self, task_id: UUID) -> List[TaskAttachment]:
        return (
            self.session.query(TaskAttachment)
            .filter(TaskAttachment.task_id == task_id)
            .order_by(TaskAttachment.created_at.desc())
            .all()
        )

    def get_attachment_by_id(self, attachment_id: UUID) -> Optional[TaskAttachment]:
        return (
            self.session.query(TaskAttachment)
            .filter(TaskAttachment.id == attachment_id)
            .first()
        )

    def create_attachment(
        self,
        task_id: UUID,
        file_name: str,
        file_path: str,
        file_size: Optional[int],
        content_type: Optional[str],
        uploaded_by: UUID,
    ) -> TaskAttachment:
        att = TaskAttachment(
            task_id=task_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            content_type=content_type,
            uploaded_by=uploaded_by,
        )
        self.session.add(att)
        self.session.commit()
        self.session.refresh(att)
        return att

    def delete_attachment(self, attachment: TaskAttachment) -> None:
        self.session.delete(attachment)
        self.session.commit()

    def mark_attachment_sent(self, attachment: TaskAttachment) -> None:
        attachment.sent_to_client = True
        attachment.sent_at = datetime.now(timezone.utc)
        self.session.commit()

    # ──────────────────────────────────────────────
    # SLA Alert Queries
    # ──────────────────────────────────────────────

    def _get_done_phase_ids(self, user_id: UUID) -> list[str]:
        """Return phase IDs for phases that should be excluded (Concluído)."""
        done_phase = (
            self.session.query(TaskPhase)
            .filter(TaskPhase.user_id == user_id, TaskPhase.name == "Concluído")
            .first()
        )
        return [str(done_phase.id)] if done_phase else []

    def get_tasks_overdue(self, user_id: UUID) -> List[Task]:
        """Get tasks past their deadline, excluding completed/cancelled."""
        done_ids = self._get_done_phase_ids(user_id)
        query = self.session.query(Task).filter(
            Task.user_id == user_id,
            Task.deleted_at.is_(None),
            Task.cancelled_at.is_(None),
            Task.deadline.isnot(None),
            Task.deadline < datetime.now(timezone.utc),
        )
        if done_ids:
            query = query.filter(~Task.phase_id.in_(done_ids))
        return query.order_by(Task.deadline.asc()).all()

    def get_tasks_near_deadline(self, user_id: UUID, days_ahead: int = 2) -> List[Task]:
        """Get tasks with deadline within the next N days, excluding completed/cancelled."""
        from datetime import timedelta

        done_ids = self._get_done_phase_ids(user_id)
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days_ahead)
        query = self.session.query(Task).filter(
            Task.user_id == user_id,
            Task.deleted_at.is_(None),
            Task.cancelled_at.is_(None),
            Task.deadline.isnot(None),
            Task.deadline >= now,
            Task.deadline <= cutoff,
        )
        if done_ids:
            query = query.filter(~Task.phase_id.in_(done_ids))
        return query.order_by(Task.deadline.asc()).all()

    def get_tasks_by_client_and_month(
        self, client_id: UUID, start_date: datetime, end_date: datetime
    ) -> List[Task]:
        """Get all tasks for a client within a date range."""
        return (
            self.session.query(Task)
            .filter(
                Task.client_id == client_id,
                Task.deleted_at.is_(None),
                Task.deadline >= start_date,
                Task.deadline <= end_date,
            )
            .order_by(Task.deadline.asc())
            .all()
        )

    # ──────────────────────────────────────────────
    # RoutineType
    # ──────────────────────────────────────────────

    def create_routine_type(self, user_id: UUID, data: RoutineTypeCreate) -> RoutineType:
        obj = RoutineType(**data.model_dump(), user_id=user_id)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def list_routine_types(self, user_id: UUID) -> List[RoutineType]:
        return (
            self.session.query(RoutineType)
            .filter(RoutineType.user_id == user_id)
            .order_by(RoutineType.name)
            .all()
        )

    def get_routine_type(self, type_id: UUID, user_id: UUID) -> Optional[RoutineType]:
        return (
            self.session.query(RoutineType)
            .filter(RoutineType.id == type_id, RoutineType.user_id == user_id)
            .first()
        )

    def update_routine_type(self, type_id: UUID, user_id: UUID, data: RoutineTypeUpdate) -> Optional[RoutineType]:
        obj = self.get_routine_type(type_id, user_id)
        if not obj:
            return None
        for key, val in data.model_dump(exclude_unset=True).items():
            setattr(obj, key, val)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete_routine_type(self, type_id: UUID, user_id: UUID) -> bool:
        obj = self.get_routine_type(type_id, user_id)
        if not obj:
            return False
        # Set routine_type_id to NULL on templates that reference it
        self.session.query(ActivityTemplate).filter(
            ActivityTemplate.routine_type_id == type_id
        ).update({ActivityTemplate.routine_type_id: None})
        self.session.delete(obj)
        self.session.commit()
        return True
