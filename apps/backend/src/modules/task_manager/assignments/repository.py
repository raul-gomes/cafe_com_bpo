from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from ..models import ClientTemplateAssignment, Task
from ..schemas import ClientTemplateAssignmentCreate


class AssignmentRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── ClientTemplateAssignment CRUD ──

    def get_assignments_by_client(self, client_id: UUID) -> List[ClientTemplateAssignment]:
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

    def count_active_assignments(self) -> int:
        """Count active assignments (is_active == True)."""
        return (
            self.session.query(ClientTemplateAssignment)
            .filter(ClientTemplateAssignment.is_active)
            .count()
        )

    # ── Assignment helpers (cross-domain task queries) ──

    def hard_delete_future_incomplete_tasks_by_assignment(
        self, assignment_id: UUID
    ) -> int:
        """Permanently delete incomplete tasks for an assignment whose deadline
        is today or in the future. Returns count of deleted tasks."""
        now = datetime.now(timezone.utc)
        tasks = (
            self.session.query(Task)
            .filter(
                Task.assignment_id == assignment_id,
                Task.completed_at.is_(None),
                Task.deadline >= now,
                Task.is_active,
            )
            .all()
        )
        count = len(tasks)
        for t in tasks:
            self.session.delete(t)
        self.session.commit()
        return count

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
                Task.is_active,
            )
            .all()
        )

    def has_pending_task(
        self,
        assignment_id: UUID,
        title: str,
        deadline: Optional[datetime] = None,
    ) -> bool:
        """Check if there is a pending (not done/cancelled) task for this assignment
        with the given title, optionally filtered by deadline.

        Uses title to distinguish between multiple activities within the same template,
        ensuring each activity gets its own task card.
        """
        query = self.session.query(Task.id).filter(
            Task.assignment_id == assignment_id,
            Task.title == title,
            Task.is_active,
            Task.status.notin_(["done", "cancelled"]),
        )
        if deadline is not None:
            deadline_start = deadline.replace(hour=0, minute=0, second=0, microsecond=0)
            deadline_end = deadline.replace(
                hour=23, minute=59, second=59, microsecond=999999
            )
            query = query.filter(
                Task.deadline >= deadline_start,
                Task.deadline <= deadline_end,
            )
        existing = query.first()
        return existing is not None

    def task_exists_by_instance_id(self, instance_id: UUID) -> bool:
        """Check if a pending task with the given routine_instance_id exists."""
        existing = (
            self.session.query(Task.id)
            .filter(
                Task.routine_instance_id == instance_id,
                Task.is_active,
                Task.status.notin_(["done", "cancelled"]),
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
