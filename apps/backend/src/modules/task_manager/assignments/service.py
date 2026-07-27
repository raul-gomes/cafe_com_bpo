"""
Assignments Module - Service Layer

Business logic for client-template assignment lifecycle (assign, unassign, regenerate).
"""

from typing import Optional
from uuid import UUID
from datetime import datetime, timezone

from ..scheduler import (
    calculate_activity_deadline,
    build_routine_instance_id,
    get_weekly_deadlines_for_year_month,
    next_business_day,
)
from ..schemas import (
    TaskCreate,
    ClientTemplateAssignmentCreate,
    ClientTemplateAssignmentResponse,
)
from ..assignments.repository import AssignmentRepository
from ..templates.repository import TemplateRepository
from ..task.repository import TaskRepository
from src.core.utils import next_business_day as nb_util
from src.core.logger import log


class AssignmentService:
    """Service layer for assignment operations."""

    def __init__(
        self,
        assignment_repo: AssignmentRepository,
        template_repo: Optional[TemplateRepository] = None,
        task_repo: Optional[TaskRepository] = None,
    ):
        self.assignment_repo = assignment_repo
        self.template_repo = template_repo or TemplateRepository(
            assignment_repo.session
        )
        self.task_repo = task_repo or TaskRepository(assignment_repo.session)

    def assign_template_to_client(
        self, assignment_in: ClientTemplateAssignmentCreate, user_id: UUID
    ) -> dict:
        """Assign a template to a client and auto-generate tasks."""
        # Validate template exists
        tmpl = self.template_repo.get_template_by_id(
            assignment_in.template_id, user_id
        )
        if not tmpl:
            raise ValueError(f"Template {assignment_in.template_id} not found")

        # Create assignment
        assignment = self.assignment_repo.create_assignment(assignment_in, user_id)

        # Get template activities
        activities = self.template_repo.get_activities_by_template(
            assignment_in.template_id
        )

        # Get first phase (order=0, inicial) for default placement
        phases = self.task_repo.get_phases_by_user(user_id)
        first_phase = phases[0] if phases else None

        # Generate tasks for each activity
        generated_tasks = []

        if tmpl.recurrence == "daily":
            # Daily: generate for next business day (short-term, OK to pre-generate)
            now = datetime.now(timezone.utc)
            if now.weekday() < 5:
                deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
                daily_deadline = nb_util(deadline)

                for act in activities:
                    if self.assignment_repo.has_pending_task(
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
                    task = self.task_repo.create(task_data, user_id)
                    if first_phase:
                        task.phase_id = first_phase.id
                    generated_tasks.append(task)

        elif tmpl.recurrence == "once":
            # Once: one-off tasks, generate immediately
            for act in activities:
                deadline = calculate_activity_deadline(
                    act, assignment.start_date, tmpl
                )
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
                task = self.task_repo.create(task_data, user_id)
                if first_phase:
                    task.phase_id = first_phase.id
                generated_tasks.append(task)

        else:
            # Weekly, monthly, yearly → do NOT generate on assignment.
            # The Rocketry scheduler handles generation on schedule
            log.info(
                f"⏳ Template '{tmpl.name}' ({tmpl.recurrence}) vinculado — "
                f"tasks serão geradas pelo scheduler agendado"
            )

        if generated_tasks:
            self.assignment_repo.session.commit()
            for t in generated_tasks:
                self.assignment_repo.session.refresh(t)

        log.info(
            f"🚀 Template '{tmpl.name}' vinculado ao cliente {assignment_in.client_id} — "
            f"{len(generated_tasks)} tarefas geradas"
        )

        return {
            "assignment_id": str(assignment.id),
            "tasks_generated": len(generated_tasks),
            "template_name": tmpl.name,
        }

    def get_client_assignments(
        self, client_id: UUID
    ) -> list[ClientTemplateAssignmentResponse]:
        assignments = self.assignment_repo.get_assignments_by_client(client_id)
        return [ClientTemplateAssignmentResponse.model_validate(a) for a in assignments]

    def remove_client_assignment(self, assignment_id: UUID, user_id: UUID) -> None:
        assignment = self.assignment_repo.get_assignment_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")
        # Delete future incomplete tasks before removing the assignment
        deleted = (
            self.assignment_repo.hard_delete_future_incomplete_tasks_by_assignment(
                assignment_id
            )
        )
        if deleted:
            log.info(
                f"🧹 Deleted {deleted} future incomplete tasks for assignment {assignment_id}"
            )
        self.assignment_repo.delete_assignment(assignment)

    def regenerate_client_tasks(self, assignment_id: UUID, user_id: UUID) -> dict:
        """Regenerate tasks for a client assignment (next period)."""
        assignment = self.assignment_repo.get_assignment_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")

        activities = self.template_repo.get_activities_by_template(
            assignment.template_id
        )
        tmpl = self.template_repo.get_template_by_id(
            assignment.template_id, user_id
        )
        if not tmpl:
            raise ValueError(f"Template {assignment.template_id} not found")

        phases = self.task_repo.get_phases_by_user(user_id)
        first_phase = phases[0] if phases else None

        generated = 0
        for act in activities:
            deadline = calculate_activity_deadline(
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
            task = self.task_repo.create(task_data, user_id)
            if first_phase:
                task.phase_id = first_phase.id
            generated += 1

        if generated:
            self.assignment_repo.session.commit()

        return {"tasks_generated": generated}
