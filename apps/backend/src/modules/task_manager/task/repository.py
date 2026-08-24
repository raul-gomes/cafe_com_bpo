from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import or_, update
from sqlalchemy.orm import Session, joinedload

from ..models import Task, TaskPhase
from ..schemas import TaskCreate, TaskPhaseUpdate, TaskUpdate


class TaskRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Task CRUD ──

    def get_by_id(self, task_id: UUID, user_id: UUID) -> Task | None:
        return (
            self.session.query(Task)
            .options(joinedload(Task.client))
            .filter(
                Task.id == task_id,
                Task.user_id == user_id,
                Task.is_active,
            )
            .first()
        )

    def get_by_id_for_update(self, task_id: UUID, user_id: UUID) -> Task | None:
        """Retorna a task para atualização.

        Permite acesso quando o usuário é o dono da task OU membro ativo do
        time do cliente com acesso à rotina (template) da task — assim um
        membro pode mover/editar tasks de rotinas compartilhadas.
        """
        task = (
            self.session.query(Task)
            .options(joinedload(Task.client))
            .filter(Task.id == task_id, Task.is_active)
            .first()
        )
        if not task:
            return None
        if task.user_id == user_id:
            return task

        # Task de outra pessoa: só membro com acesso à rotina compartilhada
        if task.template_id is None:
            return None

        from src.modules.team.repository import TeamRepository

        team_repo = TeamRepository(self.session)
        if not team_repo.is_team_member(task.client_id, user_id):
            return None
        granted = team_repo.get_routines_for_member(task.client_id, user_id)
        if any(str(g.id) == str(task.template_id) for g in granted):
            return task
        return None

    def get_by_user(
        self,
        user_id: UUID,
        process_type_filter: str | None = None,
        today_filter: bool = False,
        overdue_filter: bool = False,
    ) -> list[Task]:
        query = (
            self.session.query(Task)
            .options(joinedload(Task.client))
            .filter(Task.user_id == user_id, Task.is_active)
        )

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
                Task.completed_at.is_(None),
                Task.is_cancelled == False,
            )
        return query.order_by(Task.deadline.asc().nullslast()).all()

    def get_tasks_for_member(
        self,
        user_id: UUID,
        granted_template_ids: list[UUID],
        today_filter: bool = False,
        overdue_filter: bool = False,
    ) -> list[Task]:
        """Get a member's visible tasks: their own tasks plus tasks from
        the routines (templates) they were granted access to via invitation."""
        own_cond = Task.user_id == user_id
        if granted_template_ids:
            cond = or_(own_cond, Task.template_id.in_(granted_template_ids))
        else:
            cond = own_cond

        query = (
            self.session.query(Task)
            .options(joinedload(Task.client))
            .filter(Task.is_active, cond)
        )
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
                Task.completed_at.is_(None),
                Task.is_cancelled == False,
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
            self.session.commit()
            self.session.refresh(task)
        return task

    # ── Phase CRUD (fases globais canônicas) ──

    def get_all_phases(self) -> list[TaskPhase]:
        """Retorna as fases globais, ordenadas por `order`."""
        return self.session.query(TaskPhase).order_by(TaskPhase.order.asc()).all()

    def get_or_create_phases(self) -> list[TaskPhase]:
        """Retorna as fases canônicas, criando-as se ainda não existirem."""
        return self.ensure_canonical_phases()

    def ensure_canonical_phases(self) -> list[TaskPhase]:
        """Garante que existam exatamente as 3 fases canônicas globais:
        "a fazer" (0), "em andamento" (1), "concluido" (2, is_done=True).

        Idempotente. Remove fases extras e migra as tasks para a fase
        correspondente antes de excluí-las.
        """
        phases = self.get_all_phases()
        if not phases:
            return self.create_default_phases()

        ordered = sorted(phases, key=lambda p: (p.order, p.created_at))

        done = next((p for p in ordered if p.is_done), None)
        concluido = done if done else ordered[-1]

        a_fazer = ordered[0]
        if a_fazer is concluido:
            a_fazer = next((p for p in ordered[1:] if p is not concluido), None)

        em_andamento = next((p for p in ordered if p not in (a_fazer, concluido)), None)
        extras = [p for p in ordered if p not in (a_fazer, concluido, em_andamento)]

        if a_fazer is None:
            a_fazer = TaskPhase(
                name="a fazer",
                color="#6b7280",
                order=0,
                is_done=False,
                is_default=True,
            )
            self.session.add(a_fazer)
        if em_andamento is None:
            em_andamento = TaskPhase(
                name="em andamento",
                color="#3b82f6",
                order=1,
                is_done=False,
                is_default=True,
            )
            self.session.add(em_andamento)

        # Migra tasks das fases extras para "em andamento" via bulk update
        # (evita que o delete da fase abaixo dispare SET NULL nas tasks)
        for extra in extras:
            if extra.is_done:
                self.session.execute(
                    update(Task)
                    .where(Task.phase_id == extra.id)
                    .values(phase_id=em_andamento.id, completed_at=None)
                )
            else:
                self.session.execute(
                    update(Task)
                    .where(Task.phase_id == extra.id)
                    .values(phase_id=em_andamento.id)
                )
            self.session.delete(extra)

        # Reescreve as 3 canônicas (idempotente)
        a_fazer.name, a_fazer.color = "a fazer", "#6b7280"
        a_fazer.order, a_fazer.is_done, a_fazer.is_default = 0, False, True
        em_andamento.name, em_andamento.color = "em andamento", "#3b82f6"
        em_andamento.order, em_andamento.is_done, em_andamento.is_default = (
            1,
            False,
            True,
        )
        concluido.name, concluido.color = "concluido", "#22c55e"
        concluido.order, concluido.is_done, concluido.is_default = 2, True, True

        # Tasks já na fase done ficam com completed_at definido
        for task in self.session.query(Task).filter(
            Task.phase_id == concluido.id, Task.completed_at.is_(None)
        ):
            task.completed_at = datetime.now(timezone.utc)

        self.session.commit()
        result = self.get_all_phases()
        for p in result:
            self.session.refresh(p)
        return result

    def get_phase_by_id(self, phase_id: UUID) -> TaskPhase | None:
        """Retorna uma fase global pelo id."""
        return self.session.query(TaskPhase).filter(TaskPhase.id == phase_id).first()

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

    def create_default_phases(self) -> list[TaskPhase]:
        """Create the 3 global canonical phases."""
        from ..models import DEFAULT_PHASES

        phases = []
        for phase_data in DEFAULT_PHASES:
            phase = TaskPhase(
                name=phase_data["name"],
                color=phase_data["color"],
                order=phase_data["order"],
                is_done=phase_data["is_done"],
                is_default=True,
            )
            self.session.add(phase)
            phases.append(phase)
        self.session.commit()
        for p in phases:
            self.session.refresh(p)
        return phases

    # ── Task queries (timeline, date range) ──

    def get_tasks_in_date_range(
        self, user_id: UUID, start_date: datetime, end_date: datetime
    ) -> list[Task]:
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

    def get_tasks_with_deadline(self, user_id: UUID) -> list[Task]:
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
    ) -> list[Task]:
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

    def _get_done_phase_ids(self) -> list[str]:
        """Return phase IDs for the done (final) global phase: explicit
        ``is_done`` flag preferred, falling back to the highest ``order``."""
        done_phase = self.session.query(TaskPhase).filter(TaskPhase.is_done).first()
        if done_phase is None:
            done_phase = (
                self.session.query(TaskPhase).order_by(TaskPhase.order.desc()).first()
            )
        return [str(done_phase.id)] if done_phase else []

    def get_tasks_overdue(self, user_id: UUID) -> list[Task]:
        """Get tasks past their deadline, excluding completed/cancelled."""
        done_ids = self._get_done_phase_ids()
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

    def get_tasks_near_deadline(self, user_id: UUID, days_ahead: int = 2) -> list[Task]:
        """Get tasks with deadline within the next N days, excluding completed/cancelled."""
        done_ids = self._get_done_phase_ids()
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
    ) -> list[Task]:
        """Get tasks completed (completed_at) within a date range."""
        done_ids = self._get_done_phase_ids()
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
