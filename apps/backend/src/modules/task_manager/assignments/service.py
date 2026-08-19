"""
Assignments Module - Service Layer

Business logic for client-template assignment lifecycle (assign, unassign, regenerate).
"""

import calendar
from datetime import datetime, timedelta, timezone
from uuid import UUID

from src.core.logger import log
from src.core.utils import next_business_day as nb_util

from ..assignments.repository import AssignmentRepository
from ..scheduler import (
    build_routine_instance_id,
    calculate_activity_deadline,
    get_effective_due_day,
)
from ..schemas import (
    ClientTemplateAssignmentCreate,
    ClientTemplateAssignmentResponse,
    ClientTemplateAssignmentUpdate,
    TaskCreate,
)
from ..task.repository import TaskRepository
from ..templates.repository import TemplateRepository


class AssignmentService:
    """Service layer for assignment operations."""

    def __init__(
        self,
        assignment_repo: AssignmentRepository,
        template_repo: TemplateRepository | None = None,
        task_repo: TaskRepository | None = None,
    ):
        self.assignment_repo = assignment_repo
        self.template_repo = template_repo or TemplateRepository(
            assignment_repo.session
        )
        self.task_repo = task_repo or TaskRepository(assignment_repo.session)

    def _build_task(
        self,
        deadline: datetime,
        assignment,
        client_id: UUID,
        template_id: UUID,
        tmpl,
        user_id: UUID,
        first_phase,
        period_key: str,
        time_estimate_minutes: int | None = None,
    ):
        """Create a single task from an activity, with dedup check via routine_instance_id."""
        instance_id = build_routine_instance_id(
            assignment.id,
            tmpl.name,
            period_key,
        )
        if self.assignment_repo.task_exists_by_instance_id(instance_id):
            return None
        task_data = TaskCreate(
            title=tmpl.name,
            description=tmpl.description,
            client_id=client_id,
            priority="medium",
            process_type=tmpl.process_type,
            deadline=deadline,
            time_estimate_minutes=time_estimate_minutes,
            template_id=template_id,
            assignment_id=assignment.id,
            routine_instance_id=instance_id,
        )
        task = self.task_repo.create(task_data, user_id)
        if first_phase:
            task.phase_id = first_phase.id
        return task

    def _generate_for_activities(
        self,
        assignment,
        tmpl,
        activities: list,
        user_id: UUID,
        now: datetime | None = None,
    ) -> list:
        """Generate tasks for an assignment following the template's recurrence
        rules for the current period. Returns created tasks.

        The routine itself is the recurring task: one task per occurrence,
        regardless of how many activities the template has. Activities are
        descriptive sub-steps and do NOT become separate task cards.

        Dedup is handled via routine_instance_id (deterministic UUID per
        assignment+occurrence). Does NOT commit.
        """
        if not activities:
            return []
        phases = self.task_repo.get_or_create_phases()
        first_phase = phases[0] if phases else None
        now = now or datetime.now(timezone.utc)
        generated_tasks = []
        client_id = assignment.client_id
        template_id = assignment.template_id
        estimate = sum(a.estimated_minutes or 0 for a in activities) or None

        def _make(deadline: datetime, period_key: str) -> None:
            task = self._build_task(
                deadline,
                assignment,
                client_id,
                template_id,
                tmpl,
                user_id,
                first_phase,
                period_key=period_key,
                time_estimate_minutes=estimate,
            )
            if task:
                generated_tasks.append(task)

        if tmpl.recurrence == "daily":
            # Daily: create task for today (scheduler will handle future days)
            if now.weekday() < 5:
                deadline = now.replace(hour=18, minute=0, second=0, microsecond=0)
                daily_deadline = nb_util(deadline)
                _make(daily_deadline, daily_deadline.strftime("%Y-%m-%d"))

        elif tmpl.recurrence == "once":
            # Once: one-off, deadline = start + due_days_from_start
            deadline = calculate_activity_deadline(
                activities[0], assignment.start_date, tmpl
            )
            _make(deadline, deadline.strftime("%Y-%m-%d"))

        elif tmpl.recurrence == "weekly":
            # Weekly: remaining marked weekdays of the current week.
            # Past weekdays (before today) are ignored — scheduler regenerates
            # the full following week.
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
                        _make(deadline, period_key)

        elif tmpl.recurrence == "monthly":
            # Monthly: gera agora se o due_day ainda está por vir este mês;
            # se já passou, o scheduler gera no próximo mês.
            effective_due_day = (
                get_effective_due_day(activities[0], tmpl)
                if activities
                else tmpl.due_day
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
                    _make(deadline, period_key)
                # Se due_day já passou este mês → scheduler cria no próximo mês

        elif tmpl.recurrence in ("yearly", "annual"):
            # Yearly: gera agora se a data ainda está por vir este ano;
            # se já passou, o scheduler gera no próximo ano.
            due_month = tmpl.due_month
            effective_due_day = (
                get_effective_due_day(activities[0], tmpl)
                if activities
                else tmpl.due_day
            )
            if due_month is not None and effective_due_day is not None:
                max_day = calendar.monthrange(now.year, due_month)[1]
                due_day = min(effective_due_day, max_day)

                # Verifica se a data já passou este ano
                deadline_this_year = now.replace(
                    month=due_month,
                    day=due_day,
                    hour=18,
                    minute=0,
                    second=0,
                    microsecond=0,
                )

                if deadline_this_year.date() >= now.date():
                    # Ainda vai acontecer este ano (hoje ou futuro)
                    deadline = nb_util(deadline_this_year)
                    period_key = str(now.year)
                    _make(deadline, period_key)
                # Se já passou este ano → scheduler cria no próximo ano

        else:
            log.info(
                f"⏳ Template '{tmpl.name}' ({tmpl.recurrence}) — "
                f"tasks serão geradas pelo scheduler agendado"
            )

        return generated_tasks

    def assign_template_to_client(
        self, assignment_in: ClientTemplateAssignmentCreate, user_id: UUID
    ) -> dict:
        """Assign a template to a client and auto-generate tasks."""
        # Validate template exists
        tmpl = self.template_repo.get_template_by_id(assignment_in.template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {assignment_in.template_id} not found")

        # Create assignment
        assignment = self.assignment_repo.create_assignment(assignment_in, user_id)

        # Get template activities
        activities = self.template_repo.get_activities_by_template(
            assignment_in.template_id
        )

        # Generate tasks for each activity
        generated_tasks = self._generate_for_activities(
            assignment, tmpl, activities, user_id
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

    def generate_tasks_for_new_activities(
        self, tmpl, activities: list, user_id: UUID
    ) -> int:
        """Generate tasks for newly added activities across all active assignments
        of the template. Follows the same recurrence logic used at assign time.
        """
        assignments = self.assignment_repo.get_assignments_by_template(tmpl.id)
        active = [a for a in assignments if a.is_active]
        if not active or not activities:
            return 0

        generated_tasks = []
        for assignment in active:
            generated_tasks.extend(
                self._generate_for_activities(assignment, tmpl, activities, user_id)
            )

        if generated_tasks:
            self.assignment_repo.session.commit()
            for t in generated_tasks:
                self.assignment_repo.session.refresh(t)

        if generated_tasks:
            log.info(
                f"➕ {len(generated_tasks)} tasks geradas para atividade(s) nova(s) "
                f"do template '{tmpl.name}' em {len(active)} vínculo(s)"
            )

        return len(generated_tasks)

    def get_client_assignments(
        self, client_id: UUID
    ) -> list[ClientTemplateAssignmentResponse]:
        assignments = self.assignment_repo.get_assignments_by_client(client_id)
        return [ClientTemplateAssignmentResponse.model_validate(a) for a in assignments]

    def update_assignment(
        self,
        assignment_id: UUID,
        user_id: UUID,
        update_in: ClientTemplateAssignmentUpdate,
    ) -> ClientTemplateAssignmentResponse:
        assignment = self.assignment_repo.get_assignment_by_id(assignment_id)
        if not assignment:
            raise ValueError(f"Assignment {assignment_id} not found")
        if update_in.is_active is not None:
            assignment.is_active = update_in.is_active
            self.assignment_repo.session.commit()
            self.assignment_repo.session.refresh(assignment)
            log.info(
                f"🔁 Vínculo {assignment_id} {'ativado' if update_in.is_active else 'desativado'} "
                f"pelo usuário {user_id}"
            )
        return ClientTemplateAssignmentResponse.model_validate(assignment)

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
        tmpl = self.template_repo.get_template_by_id(assignment.template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {assignment.template_id} not found")

        generated_tasks = self._generate_for_activities(
            assignment,
            tmpl,
            activities,
            user_id,
            now=datetime.now(timezone.utc) + timedelta(days=1),
        )

        if generated_tasks:
            self.assignment_repo.session.commit()
            for t in generated_tasks:
                self.assignment_repo.session.refresh(t)

        return {"tasks_generated": len(generated_tasks)}
