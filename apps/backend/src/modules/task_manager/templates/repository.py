from uuid import UUID

from sqlalchemy import and_, asc, case, or_
from sqlalchemy.orm import Session, aliased

from ..models import (
    ActivityTemplate,
    ClientTemplateAssignment,
    TemplateActivity,
    UserTemplateArchive,
)
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

    def get_templates_by_user(
        self, user_id: UUID
    ) -> list[tuple[ActivityTemplate, bool]]:
        """Templates próprios + rotinas gerais (visíveis a todos).

        Retorna tuplas (template, is_archived_for_user) onde is_archived_for_user
        é determinado por:
        - Rotinas pessoais: coluna is_archived do template
        - Rotinas gerais: LEFT JOIN com user_template_archives

        Ordenação: ativos primeiro, depois arquivados.
        """
        archive_alias = aliased(UserTemplateArchive)
        fork_alias = aliased(ActivityTemplate)

        # Rotinas gerais para as quais o usuário já criou uma cópia (fork) não
        # aparecem mais na listagem — ele passa a trabalhar com a própria versão.
        general_without_fork = and_(
            ActivityTemplate.is_general.is_(True),
            ~self.session.query(fork_alias.id)
            .filter(
                fork_alias.parent_template_id == ActivityTemplate.id,
                fork_alias.user_id == user_id,
            )
            .exists(),
        )

        results = (
            self.session.query(
                ActivityTemplate,
                case(
                    (
                        ActivityTemplate.is_general.is_(True),
                        archive_alias.id.isnot(None),
                    ),
                    else_=ActivityTemplate.is_archived,
                ).label("is_archived_for_user"),
            )
            .outerjoin(
                archive_alias,
                and_(
                    archive_alias.template_id == ActivityTemplate.id,
                    archive_alias.user_id == user_id,
                ),
            )
            .filter(
                or_(
                    ActivityTemplate.user_id == user_id,
                    general_without_fork,
                )
            )
            .order_by(
                asc("is_archived_for_user"),
                asc(ActivityTemplate.created_at),
            )
            .all()
        )
        return results

    def is_archived_for_user(self, template_id: UUID, user_id: UUID) -> bool:
        """Check if a general template is archived for a specific user."""
        record = (
            self.session.query(UserTemplateArchive)
            .filter(
                UserTemplateArchive.template_id == template_id,
                UserTemplateArchive.user_id == user_id,
            )
            .first()
        )
        return record is not None

    def set_archived_for_user(
        self, template_id: UUID, user_id: UUID, archived: bool
    ) -> None:
        """Set/unset archive status for a general template per user."""
        if archived:
            existing = (
                self.session.query(UserTemplateArchive)
                .filter(
                    UserTemplateArchive.template_id == template_id,
                    UserTemplateArchive.user_id == user_id,
                )
                .first()
            )
            if not existing:
                self.session.add(
                    UserTemplateArchive(template_id=template_id, user_id=user_id)
                )
        else:
            (
                self.session.query(UserTemplateArchive)
                .filter(
                    UserTemplateArchive.template_id == template_id,
                    UserTemplateArchive.user_id == user_id,
                )
                .delete()
            )
        self.session.commit()

    def get_template_by_id(
        self, template_id: UUID, user_id: UUID, include_general: bool = False
    ) -> ActivityTemplate | None:
        """Busca template do usuário.

        include_general=True também retorna rotinas gerais de outros usuários
        (leitura/vínculo). Escrita continua restrita ao dono.
        """
        conditions = [ActivityTemplate.id == template_id]
        if include_general:
            conditions.append(
                or_(
                    ActivityTemplate.user_id == user_id,
                    ActivityTemplate.is_general.is_(True),
                )
            )
        else:
            conditions.append(ActivityTemplate.user_id == user_id)
        return self.session.query(ActivityTemplate).filter(*conditions).first()

    def get_user_fork_of(
        self, template_id: UUID, user_id: UUID
    ) -> ActivityTemplate | None:
        """Retorna a cópia (fork) que o usuário já criou de uma rotina geral."""
        return (
            self.session.query(ActivityTemplate)
            .filter(
                ActivityTemplate.parent_template_id == template_id,
                ActivityTemplate.user_id == user_id,
            )
            .first()
        )

    def migrate_assignments_for_user(
        self, old_template_id: UUID, new_template_id: UUID, user_id: UUID
    ) -> int:
        """Reaponta os vínculos do usuário de um template para outro.

        Usado no fork: os vínculos existentes passam a seguir a cópia do
        usuário (as próximas gerações usam a versão dele).
        """
        result = (
            self.session.query(ClientTemplateAssignment)
            .filter(
                ClientTemplateAssignment.template_id == old_template_id,
                ClientTemplateAssignment.user_id == user_id,
            )
            .update(
                {ClientTemplateAssignment.template_id: new_template_id},
                synchronize_session=False,
            )
        )
        self.session.commit()
        return result

    def create_fork(
        self, template: ActivityTemplate, user_id: UUID
    ) -> ActivityTemplate:
        """Cria a cópia privada (fork) de uma rotina geral para o usuário.

        Copia o template e suas atividades e reaponta os vínculos existentes
        do usuário para a nova cópia. O mestre permanece intacto para os demais.
        """
        tmpl = ActivityTemplate(
            user_id=user_id,
            name=template.name,
            description=template.description,
            process_type=template.process_type,
            recurrence=template.recurrence,
            weekday_mask=template.weekday_mask,
            due_day=template.due_day,
            due_month=template.due_month,
            due_days_from_start=template.due_days_from_start,
            due_date=template.due_date,
            recurrence_end_date=template.recurrence_end_date,
            is_active=template.is_active,
            is_general=False,
            is_archived=False,
            parent_template_id=template.id,
            routine_type_id=template.routine_type_id,
        )
        self.session.add(tmpl)
        self.session.flush()
        for act in self.get_activities_by_template(template.id):
            self.session.add(
                TemplateActivity(
                    template_id=tmpl.id,
                    name=act.name,
                    description=act.description,
                    priority=act.priority,
                    due_day=act.due_day,
                    due_days=act.due_days,
                    estimated_minutes=act.estimated_minutes,
                    order=act.order,
                    phase_id=act.phase_id,
                )
            )
        self.session.flush()
        self.migrate_assignments_for_user(template.id, tmpl.id, user_id)
        self.session.commit()
        self.session.refresh(tmpl)
        return tmpl

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

    def get_activities_by_template(self, template_id: UUID) -> list[TemplateActivity]:
        return (
            self.session.query(TemplateActivity)
            .filter(TemplateActivity.template_id == template_id)
            .order_by(TemplateActivity.order.asc())
            .all()
        )

    def get_activity_by_id(self, activity_id: UUID) -> TemplateActivity | None:
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
