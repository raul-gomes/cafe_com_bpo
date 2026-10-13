"""
Templates Module - Service Layer

Business logic for ActivityTemplate and TemplateActivity CRUD.
"""

from datetime import datetime, timezone
from uuid import UUID

from src.core.logger import log

from ..models import ActivityTemplate, TemplateActivity
from ..routine_types.repository import RoutineTypeRepository
from ..schemas import (
    ActivityTemplateCreate,
    ActivityTemplateListItem,
    ActivityTemplateResponse,
    ActivityTemplateUpdate,
    OverdueTemplateResponse,
    TemplateActivityCreate,
    TemplateActivityResponse,
    TemplateActivityUpdate,
)
from ..templates.repository import TemplateRepository
from ..weekdays import parse_weekday_mask


class TemplateService:
    """Service layer for template operations."""

    def __init__(
        self,
        repository: TemplateRepository,
        routine_type_repo: RoutineTypeRepository | None = None,
    ):
        self.repository = repository
        self.routine_type_repo = routine_type_repo or RoutineTypeRepository(
            repository.session
        )

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

    def get_templates(self, user_id: UUID) -> list[ActivityTemplateListItem]:
        """List all templates for a user with activity count and overdue status."""
        rows = self.repository.get_templates_by_user(user_id)
        result = []
        for tmpl, is_archived_for_user in rows:
            activities = self.repository.get_activities_by_template(tmpl.id)
            # Lookup routine type info
            rt_name = None
            rt_color = None
            if tmpl.routine_type_id:
                rt = self.routine_type_repo.get_routine_type(
                    tmpl.routine_type_id, user_id
                )
                if rt:
                    rt_name = rt.name
                    rt_color = rt.color
            result.append(
                ActivityTemplateListItem(
                    id=tmpl.id,
                    user_id=tmpl.user_id,
                    name=tmpl.name,
                    description=tmpl.description,
                    process_type=tmpl.process_type,
                    recurrence=tmpl.recurrence,
                    weekdays=parse_weekday_mask(tmpl.weekday_mask),
                    due_day=tmpl.due_day,
                    due_month=tmpl.due_month,
                    due_days_from_start=tmpl.due_days_from_start,
                    is_active=tmpl.is_active,
                    is_general=tmpl.is_general,
                    is_archived=is_archived_for_user,
                    is_overdue=self._is_template_overdue(tmpl),
                    days_overdue=self._compute_days_overdue(tmpl),
                    activity_count=len(activities),
                    routine_type_id=tmpl.routine_type_id,
                    routine_type_name=rt_name,
                    routine_type_color=rt_color,
                )
            )
        return result

    def get_overdue_templates(self, user_id: UUID) -> list[OverdueTemplateResponse]:
        """Return only overdue templates for dashboard alerts."""
        rows = self.repository.get_templates_by_user(user_id)
        result = []
        for tmpl, _is_archived in rows:
            if not self._is_template_overdue(tmpl):
                continue
            activities = self.repository.get_activities_by_template(tmpl.id)
            days_overdue = self._compute_days_overdue(tmpl)
            result.append(
                OverdueTemplateResponse(
                    id=tmpl.id,
                    name=tmpl.name,
                    recurrence=tmpl.recurrence,
                    days_overdue=days_overdue,
                    activity_count=len(activities),
                )
            )
        return result

    def get_template(
        self, template_id: UUID, user_id: UUID
    ) -> ActivityTemplateResponse | None:
        """Get a single template with all its activities.

        Rotinas gerais de outros usuários são legíveis (include_general).
        is_archived é per-user para rotinas gerais.
        """
        tmpl = self.repository.get_template_by_id(
            template_id, user_id, include_general=True
        )
        if not tmpl:
            return None
        activities = self.repository.get_activities_by_template(template_id)
        rt_name = None
        rt_color = None
        if tmpl.routine_type_id:
            rt = self.routine_type_repo.get_routine_type(tmpl.routine_type_id, user_id)
            if rt:
                rt_name = rt.name
                rt_color = rt.color
        if tmpl.is_general:
            is_archived = self.repository.is_archived_for_user(template_id, user_id)
        else:
            is_archived = tmpl.is_archived
        return ActivityTemplateResponse(
            id=tmpl.id,
            user_id=tmpl.user_id,
            name=tmpl.name,
            description=tmpl.description,
            process_type=tmpl.process_type,
            recurrence=tmpl.recurrence,
            weekdays=parse_weekday_mask(tmpl.weekday_mask),
            due_day=tmpl.due_day,
            due_month=tmpl.due_month,
            due_days_from_start=tmpl.due_days_from_start,
            is_active=tmpl.is_active,
            is_general=tmpl.is_general,
            is_archived=is_archived,
            routine_type_id=tmpl.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            activities=[TemplateActivityResponse.model_validate(a) for a in activities],
        )

    def create_template(
        self,
        template_in: ActivityTemplateCreate,
        user_id: UUID,
        is_admin: bool = False,
    ) -> ActivityTemplateResponse:
        if template_in.is_general and not is_admin:
            raise PermissionError("Apenas administradores podem criar rotinas gerais")
        tmpl = self.repository.create_template(template_in, user_id)
        log.info(f"📋 Template criado: {tmpl.name} por usuário {user_id}")
        rt_name = None
        rt_color = None
        if tmpl.routine_type_id:
            rt = self.routine_type_repo.get_routine_type(tmpl.routine_type_id, user_id)
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
            weekdays=parse_weekday_mask(tmpl.weekday_mask),
            due_day=tmpl.due_day,
            due_month=tmpl.due_month,
            due_days_from_start=tmpl.due_days_from_start,
            is_active=tmpl.is_active,
            is_general=tmpl.is_general,
            routine_type_id=tmpl.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            activities=[],
        )

    def _resolve_for_write(self, template_id: UUID, user_id: UUID) -> ActivityTemplate:
        """Resolve o template para uma operação de escrita.

        Se for uma rotina geral de outro usuário, cria (ou reutiliza) a cópia
        privada (fork) do usuário e retorna essa cópia — as alterações valem
        somente para ele. Se for do próprio usuário, retorna o template.
        """
        tmpl = self.repository.get_template_by_id(
            template_id, user_id, include_general=True
        )
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        if tmpl.user_id == user_id:
            return tmpl
        if not tmpl.is_general:
            raise ValueError(f"Template {template_id} not found")
        fork = self.repository.get_user_fork_of(template_id, user_id)
        if fork:
            return fork
        return self.repository.create_fork(tmpl, user_id)

    def update_template(
        self, template_id: UUID, user_id: UUID, template_in: ActivityTemplateUpdate
    ) -> ActivityTemplateResponse:
        tmpl = self._resolve_for_write(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        updated = self.repository.update_template(tmpl, template_in)
        activities = self.repository.get_activities_by_template(template_id)
        rt_name = None
        rt_color = None
        if updated.routine_type_id:
            rt = self.routine_type_repo.get_routine_type(
                updated.routine_type_id, user_id
            )
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
            weekdays=parse_weekday_mask(updated.weekday_mask),
            due_day=updated.due_day,
            due_month=updated.due_month,
            due_days_from_start=updated.due_days_from_start,
            is_active=updated.is_active,
            is_general=updated.is_general,
            is_archived=updated.is_archived,
            routine_type_id=updated.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            activities=[TemplateActivityResponse.model_validate(a) for a in activities],
        )

    def delete_template(self, template_id: UUID, user_id: UUID) -> None:
        tmpl = self._resolve_for_write(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        self.repository.delete_template(tmpl)
        log.info(f"🗑️ Template excluído: {template_id}")

    def toggle_archive(
        self, template_id: UUID, user_id: UUID
    ) -> ActivityTemplateResponse:
        """Alterna o status de arquivo de um template.

        Rotinas pessoais: alterna is_archived no template.
        Rotinas gerais: cria/remove registro em user_template_archives.
        """
        tmpl = self.repository.get_template_by_id(
            template_id, user_id, include_general=True
        )
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        if tmpl.is_general:
            is_now_archived = not self.repository.is_archived_for_user(
                template_id, user_id
            )
            self.repository.set_archived_for_user(template_id, user_id, is_now_archived)
            log.info(
                f"📦 Template geral {template_id} {'arquivado' if is_now_archived else 'desarquivado'} por usuário {user_id}"
            )
        else:
            if tmpl.user_id != user_id:
                raise ValueError("Apenas o criador pode arquivar esta rotina")
            tmpl.is_archived = not tmpl.is_archived
            is_now_archived = tmpl.is_archived
            self.repository.session.commit()
            self.repository.session.refresh(tmpl)
            log.info(
                f"📦 Template {template_id} {'arquivado' if tmpl.is_archived else 'desarquivado'}"
            )

        activities = self.repository.get_activities_by_template(template_id)
        rt_name = None
        rt_color = None
        if tmpl.routine_type_id:
            rt = self.routine_type_repo.get_routine_type(tmpl.routine_type_id, user_id)
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
            weekdays=parse_weekday_mask(tmpl.weekday_mask),
            due_day=tmpl.due_day,
            due_month=tmpl.due_month,
            due_days_from_start=tmpl.due_days_from_start,
            is_active=tmpl.is_active,
            is_general=tmpl.is_general,
            is_archived=is_now_archived,
            routine_type_id=tmpl.routine_type_id,
            routine_type_name=rt_name,
            routine_type_color=rt_color,
            activities=[TemplateActivityResponse.model_validate(a) for a in activities],
        )

    # ── Template Activities ──

    def create_activity(
        self, template_id: UUID, user_id: UUID, activity_in: TemplateActivityCreate
    ) -> TemplateActivityResponse:
        tmpl = self._resolve_for_write(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        act = self.repository.create_activity(tmpl.id, activity_in)
        # Gera tasks para a atividade nova em todas as rotinas já vinculadas a clientes
        self._generate_tasks_for_new_activity(tmpl, act, user_id)
        return TemplateActivityResponse.model_validate(act)

    def _generate_tasks_for_new_activity(self, tmpl, act, user_id: UUID) -> int:
        """Generates tasks for a newly added activity across active assignments."""
        try:
            from ..assignments.repository import AssignmentRepository
            from ..assignments.service import AssignmentService

            service = AssignmentService(AssignmentRepository(self.repository.session))
            return service.generate_tasks_for_new_activities(tmpl, [act], user_id)
        except Exception as e:  # pragma: no cover - defensive
            log.warning(f"⚠️ Falha ao gerar tasks para atividade nova: {e}")
            return 0

    def _activity_for_write(
        self, template_id: UUID, activity_id: UUID, user_id: UUID
    ) -> TemplateActivity:
        """Activity the caller may change, inside their own copy of the routine.

        The id is checked against the routine *before* any fork is created, so
        an unknown id leaves nothing behind. On a general routine of someone
        else the write goes to the caller's private copy: an id of the master
        (what the screen shows until it reloads) is mapped to the copied
        activity through `source_activity_id` (AUD-019). Forks made before that
        column existed fall back to a single activity with the same name and
        order.

        Args:
            template_id: Routine id from the route.
            activity_id: Activity id from the route.
            user_id: The caller.

        Returns:
            The activity to change (the caller's own, or the copy of the master's).

        Raises:
            ValueError: When the routine or the activity is not reachable.
        """
        not_found = ValueError("Activity not found")
        original = self.repository.get_template_by_id(
            template_id, user_id, include_general=True
        )
        act = self.repository.get_activity_by_id(activity_id)
        if not original or not act:
            raise not_found
        existing_fork = (
            None
            if original.user_id == user_id
            else self.repository.get_user_fork_of(template_id, user_id)
        )
        allowed = {str(original.id)} | (
            {str(existing_fork.id)} if existing_fork else set()
        )
        if str(act.template_id) not in allowed:
            raise not_found

        tmpl = self._resolve_for_write(template_id, user_id)
        if str(act.template_id) == str(tmpl.id):
            return act
        copies = self.repository.get_activities_by_template(tmpl.id)
        mapped = [c for c in copies if c.source_activity_id == act.id]
        if not mapped:
            mapped = [
                c
                for c in copies
                if c.source_activity_id is None
                and c.name == act.name
                and c.order == act.order
            ]
        if len(mapped) != 1:
            raise not_found
        return mapped[0]

    def update_activity(
        self,
        template_id: UUID,
        activity_id: UUID,
        user_id: UUID,
        activity_in: TemplateActivityUpdate,
    ) -> TemplateActivityResponse:
        """Updates an activity of the caller's routine (or of their fork).

        Args:
            template_id: Routine id.
            activity_id: Activity id (the master's id is accepted on a fork).
            user_id: The caller.
            activity_in: Fields to change.

        Returns:
            The updated activity.

        Raises:
            ValueError: When the routine or the activity is not reachable.
        """
        act = self._activity_for_write(template_id, activity_id, user_id)
        updated = self.repository.update_activity(act, activity_in)
        return TemplateActivityResponse.model_validate(updated)

    def delete_activity(
        self, template_id: UUID, activity_id: UUID, user_id: UUID
    ) -> None:
        """Deletes an activity of the caller's routine (or of their fork).

        Args:
            template_id: Routine id.
            activity_id: Activity id (the master's id is accepted on a fork).
            user_id: The caller.

        Raises:
            ValueError: When the routine or the activity is not reachable.
        """
        act = self._activity_for_write(template_id, activity_id, user_id)
        self.repository.delete_activity(act)

    def reorder_activities(
        self, template_id: UUID, user_id: UUID, ordered_ids: list[UUID]
    ) -> list[TemplateActivityResponse]:
        tmpl = self._resolve_for_write(template_id, user_id)
        if not tmpl:
            raise ValueError(f"Template {template_id} not found")
        self.repository.reorder_activities(tmpl.id, ordered_ids)
        activities = self.repository.get_activities_by_template(tmpl.id)
        return [TemplateActivityResponse.model_validate(a) for a in activities]
