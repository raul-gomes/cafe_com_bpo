from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from ..models import ActivityTemplate, TemplateActivity
from ..schemas import (
    ActivityTemplateCreate,
    ActivityTemplateUpdate,
    TemplateActivityCreate,
    TemplateActivityUpdate,
)


class TemplateRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── ActivityTemplate CRUD ──

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

    # ── TemplateActivity CRUD ──

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
