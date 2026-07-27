"""
Assignments Module - Service Layer

Business logic for client-template assignment lifecycle (assign, unassign, regenerate).
"""

import calendar
from typing import Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from ..scheduler import (
    calculate_activity_deadline,
    build_routine_instance_id,
    get_weekly_deadlines_for_year_month,
    next_business_day,
    get_effective_due_day,
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

    def _build_task(
        self,
        act,
        deadline: datetime,
        assignment,
        assignment_in,
        tmpl,
        user_id: UUID,
        first_phase,
        period_key: str,
    ):
        """Create a single task from an activity, with dedup check via routine_instance_id."""
        instance_id = build_routine_instance_id(
            assignment.id, act.name, period_key,
        )
        if self.assignment_repo.task_exists_by_instance_id(instance_id):
            return None
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
        return task

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
        now = datetime.now(timezone.utc)

        if tmpl.recurrence == "daily":
            # Daily: create task for today (scheduler will handle future days)
            if now.weekday() < 5:
                deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
                daily_deadline = nb_util(deadline)

                for act in activities:
                    task = self._build_task(
                        act, daily_deadline, assignment, assignment_in,
                        tmpl, user_id, first_phase,
                        period_key=daily_deadline.strftime("%Y-%m-%d"),
                    )
                    if task:
                        generated_tasks.append(task)

        elif tmpl.recurrence == "once":
            # Once: one-off tasks, generate immediately
            # deadline = now + due_days (ou due_days_from_start)
            for act in activities:
                deadline = calculate_activity_deadline(
                    act, assignment.start_date, tmpl
                )
                task = self._build_task(
                    act, deadline, assignment, assignment_in,
                    tmpl, user_id, first_phase,
                    period_key=deadline.strftime("%Y-%m-%d"),
                )
                if task:
                    generated_tasks.append(task)

        elif tmpl.recurrence == "weekly":
            # Weekly: se hoje está na máscara → cria de hoje até domingo
            # Se hoje não está → cria do próximo dia válido até domingo
            # Scheduler gera as semanas seguintes
            if tmpl.weekday_mask:
                marked_days = {
                    int(d.strip()) - 1
                    for d in tmpl.weekday_mask.split(",")
                    if d.strip()
                }
                # Encontra o primeiro dia válido (hoje ou próximo)
                start = None
                for offset in range(7):
                    candidate = now + timedelta(days=offset)
                    if candidate.weekday() in marked_days:
                        start = candidate
                        break

                if start is not None:
                    days_until_sunday = 6 - start.weekday()
                    for offset in range(days_until_sunday + 1):
                        target = start + timedelta(days=offset)
                        if target.weekday() not in marked_days:
                            continue
                        deadline = target.replace(
                            hour=18, minute=0, second=0, microsecond=0
                        )
                        deadline = nb_util(deadline)
                        period_key = target.strftime("%Y-%m-%d")
                        for act in activities:
                            task = self._build_task(
                                act, deadline, assignment, assignment_in,
                                tmpl, user_id, first_phase,
                                period_key=period_key,
                            )
                            if task:
                                generated_tasks.append(task)

        elif tmpl.recurrence == "monthly":
            # Monthly: ações baseadas no due_day relativo a hoje
            effective_due_day = (
                get_effective_due_day(activities[0], tmpl)
                if activities else tmpl.due_day
            )
            if effective_due_day is not None:
                today = now.day
                max_day = calendar.monthrange(now.year, now.month)[1]
                due_day = min(effective_due_day, max_day)

                if due_day >= today:
                    # Cria task para este mês (hoje ou data futura)
                    deadline = now.replace(
                        day=due_day, hour=18, minute=0, second=0, microsecond=0
                    )
                    deadline = nb_util(deadline)
                    period_key = f"{now.year}-{now.month:02d}"
                    for act in activities:
                        task = self._build_task(
                            act, deadline, assignment, assignment_in,
                            tmpl, user_id, first_phase,
                            period_key=period_key,
                        )
                        if task:
                            generated_tasks.append(task)
                # Se due_day já passou este mês → scheduler cria no próximo mês

        elif tmpl.recurrence in ("yearly", "annual"):
            # Yearly: ações baseadas no due_month + due_day relativos a hoje
            due_month = tmpl.due_month
            effective_due_day = (
                get_effective_due_day(activities[0], tmpl)
                if activities else tmpl.due_day
            )
            if due_month is not None and effective_due_day is not None:
                max_day = calendar.monthrange(now.year, due_month)[1]
                due_day = min(effective_due_day, max_day)

                # Verifica se a data já passou este ano
                deadline_this_year = now.replace(
                    month=due_month, day=due_day,
                    hour=18, minute=0, second=0, microsecond=0,
                )

                if deadline_this_year.date() >= now.date():
                    # Ainda vai acontecer este ano (hoje ou futuro)
                    deadline = nb_util(deadline_this_year)
                    period_key = str(now.year)
                    for act in activities:
                        task = self._build_task(
                            act, deadline, assignment, assignment_in,
                            tmpl, user_id, first_phase,
                            period_key=period_key,
                        )
                        if task:
                            generated_tasks.append(task)
                # Se já passou este ano → scheduler cria no próximo ano

        else:
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
