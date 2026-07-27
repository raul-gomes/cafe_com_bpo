"""
Templates Module - Service Layer

Business logic for ActivityTemplate and TemplateActivity CRUD.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone

from ..schemas import (
    ActivityTemplateCreate,
    ActivityTemplateUpdate,
    ActivityTemplateResponse,
    ActivityTemplateListItem,
    OverdueTemplateResponse,
    TemplateActivityCreate,
    TemplateActivityUpdate,
    TemplateActivityResponse,
)
from ..models import ActivityTemplate
from ..templates.repository import TemplateRepository
from ..routine_types.repository import RoutineTypeRepository
from src.core.logger import log


class TemplateService:
    """Service layer for template operations."""

    def __init__(
        self,
        repository: TemplateRepository,
        routine_type_repo: Optional[RoutineTypeRepository] = None,
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
                rt = self.routine_type_repo.get_routine_type(
                    tmpl.routine_type_id, user_id
                )
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
            rt = self.routine_type_repo.get_routine_type(
                tmpl.routine_type_id, user_id
            )
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
            rt = self.routine_type_repo.get_routine_type(
                tmpl.routine_type_id, user_id
            )
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
            activities=[
                TemplateActivityResponse.model_validate(a) for a in activities
            ],
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
