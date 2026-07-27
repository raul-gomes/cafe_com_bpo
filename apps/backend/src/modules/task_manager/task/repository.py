from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from ..models import Task, TaskPhase, get_done_phase
from ..schemas import TaskCreate, TaskUpdate, TaskPhaseCreate, TaskPhaseUpdate


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Task CRUD ──

    def get_by_id(self, task_id: UUID, user_id: UUID) -> Optional[Task]:
        return (
            self.session.query(Task)
            .filter(
                Task.id == task_id,
                Task.user_id == user_id,
                Task.is_active,
            )
            .first()
        )

    def get_by_user(
        self,
        user_id: UUID,
        status_filter: Optional[str] = None,
        process_type_filter: Optional[str] = None,
        today_filter: bool = False,
        overdue_filter: bool = False,
    ) -> List[Task]:
        query = self.session.query(Task).filter(Task.user_id == user_id, Task.is_active)
        if status_filter:
            query = query.filter(Task.status == status_filter)

        if process_type_filter:
            query = query.filter(Task.process_type == process_type_filter)

        if today_filter:
            now = datetime.now(timezone.utc)
            day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            query = query.filter(
                Task.deadline >= day_start,
                Task.deadline < day_end,
            )

        if overdue_filter:
            now = datetime.now(timezone.utc)
            day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(
                Task.deadline < day_start,
                Task.status != "done",
                not Task.is_cancelled,
            )

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
        task.is_active = False
        task.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def cancel(self, task: Task) -> Task:
        """Mark a task as cancelled (idempotent)."""
        if not task.is_cancelled:
            task.is_cancelled = True
            task.cancelled_at = datetime.now(timezone.utc)
            task.status = "cancelled"
            self.session.commit()
            self.session.refresh(task)
        return task

    # ── Phase CRUD ──

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
        from ..models import DEFAULT_PHASES

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
                Task.is_active,
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

    # ── Task queries (timeline, date range) ──

    def get_tasks_in_date_range(
        self, user_id: UUID, start_date: datetime, end_date: datetime
    ) -> List[Task]:
        """Get all tasks within a date range."""
        return (
            self.session.query(Task)
            .filter(
                Task.user_id == user_id,
                Task.is_active,
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
                Task.is_active,
                Task.deadline.isnot(None),
            )
            .order_by(Task.deadline.asc())
            .all()
        )

    def get_tasks_by_client_and_month(
        self, client_id: UUID, start_date: datetime, end_date: datetime
    ) -> List[Task]:
        """Get all tasks for a client within a date range."""
        return (
            self.session.query(Task)
            .filter(
                Task.client_id == client_id,
                Task.is_active,
                Task.deadline >= start_date,
                Task.deadline <= end_date,
            )
            .order_by(Task.deadline.asc())
            .all()
        )

    # ── SLA Alert Queries ──

    def _get_done_phase_ids(self, user_id: UUID) -> list[str]:
        """Return phase IDs for the done (final) phase by position (max order)."""
        done_phase = (
            self.session.query(TaskPhase)
            .filter(TaskPhase.user_id == user_id)
            .order_by(TaskPhase.order.desc())
            .first()
        )
        return [str(done_phase.id)] if done_phase else []

    def get_tasks_overdue(self, user_id: UUID) -> List[Task]:
        """Get tasks past their deadline, excluding completed/cancelled."""
        done_ids = self._get_done_phase_ids(user_id)
        query = self.session.query(Task).filter(
            Task.user_id == user_id,
            Task.is_active,
            not Task.is_cancelled,
            Task.deadline.isnot(None),
            Task.deadline < datetime.now(timezone.utc),
        )
        if done_ids:
            query = query.filter(~Task.phase_id.in_(done_ids))
        return query.order_by(Task.deadline.asc()).all()

    def get_tasks_near_deadline(self, user_id: UUID, days_ahead: int = 2) -> List[Task]:
        """Get tasks with deadline within the next N days, excluding completed/cancelled."""
        done_ids = self._get_done_phase_ids(user_id)
        now = datetime.now(timezone.utc)
        cutoff = now + timedelta(days=days_ahead)
        query = self.session.query(Task).filter(
            Task.user_id == user_id,
            Task.is_active,
            not Task.is_cancelled,
            Task.deadline.isnot(None),
            Task.deadline >= now,
            Task.deadline <= cutoff,
        )
        if done_ids:
            query = query.filter(~Task.phase_id.in_(done_ids))
        return query.order_by(Task.deadline.asc()).all()

    def get_tasks_completed_in_range(
        self, user_id: UUID, start_date: datetime, end_date: datetime
    ) -> List[Task]:
        """Get tasks completed (completed_at) within a date range."""
        done_ids = self._get_done_phase_ids(user_id)
        query = self.session.query(Task).filter(
            Task.user_id == user_id,
            Task.is_active,
            not Task.is_cancelled,
            Task.completed_at.isnot(None),
            Task.completed_at >= start_date,
            Task.completed_at <= end_date,
        )
        if done_ids:
            query = query.filter(Task.phase_id.in_(done_ids))
        return query.order_by(Task.completed_at.desc()).all()
