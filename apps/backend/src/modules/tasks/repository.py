from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from .models import Task, Routine, TaskPhase
from .schemas import TaskCreate, TaskUpdate, RoutineCreate, RoutineUpdate, TaskPhaseCreate, TaskPhaseUpdate


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, task_id: UUID, user_id: UUID) -> Optional[Task]:
        return self.session.query(Task).filter(Task.id == task_id, Task.user_id == user_id).first()

    def get_by_user(
        self,
        user_id: UUID,
        status_filter: Optional[str] = None,
        process_type_filter: Optional[str] = None,
    ) -> List[Task]:
        query = self.session.query(Task).filter(
            Task.user_id == user_id,
            Task.deleted_at.is_(None)
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

    def get_routines_by_user(self, user_id: UUID) -> List[Routine]:
        return (
            self.session.query(Routine)
            .filter(Routine.user_id == user_id)
            .order_by(Routine.created_at.desc())
            .all()
        )

    def get_routine_by_id(self, routine_id: UUID, user_id: UUID) -> Optional[Routine]:
        return (
            self.session.query(Routine)
            .filter(Routine.id == routine_id, Routine.user_id == user_id)
            .first()
        )

    def create_routine(self, routine_in: RoutineCreate, user_id: UUID) -> Routine:
        routine_data = routine_in.model_dump()
        new_routine = Routine(**routine_data, user_id=user_id)
        self.session.add(new_routine)
        self.session.commit()
        self.session.refresh(new_routine)
        return new_routine

    def update_routine(self, routine: Routine, routine_in: RoutineUpdate) -> Routine:
        update_data = routine_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(routine, field, value)
        self.session.commit()
        self.session.refresh(routine)
        return routine

    def delete_routine(self, routine: Routine) -> None:
        self.session.delete(routine)
        self.session.commit()

    def get_pending_routines(self) -> List[Routine]:
        """Get all active routines that need task generation."""
        return (
            self.session.query(Routine)
            .filter(Routine.is_active == True)
            .all()
        )

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
            self.session.query(TaskPhase)
            .filter(TaskPhase.user_id == user_id)
            .count()
        )

    def get_tasks_for_phase(self, phase_id: UUID, user_id: UUID) -> List[Task]:
        """Get all tasks in a specific phase."""
        return (
            self.session.query(Task)
            .filter(Task.phase_id == phase_id, Task.user_id == user_id, Task.deleted_at.is_(None))
            .order_by(Task.deadline.asc().nullslast())
            .all()
        )

    def migrate_tasks_from_phase(self, old_phase_id: UUID, new_phase_id: Optional[UUID]) -> int:
        """Migrate all tasks from one phase to another. Returns count of migrated tasks."""
        tasks = (
            self.session.query(Task)
            .filter(Task.phase_id == old_phase_id)
            .all()
        )
        count = len(tasks)
        for task in tasks:
            task.phase_id = new_phase_id
        self.session.commit()
        return count

    def get_tasks_in_date_range(self, user_id: UUID, start_date: datetime, end_date: datetime) -> List[Task]:
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
