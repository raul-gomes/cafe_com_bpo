"""Queries over the plan catalog.

Read-only apart from `add`: the plan row is the price authority (§17.1), so this
module deliberately offers no `update` and no `delete`. A plan leaves the catalog
through `is_active`, never by disappearing — `subscriptions.plan_id` is
`ON DELETE RESTRICT`, and a plan nobody references would still be shown to the
checkout as something to buy.
"""

from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from src.modules.subscriptions.models import Plan, Subscription


class PlanRepository:
    """Data access for `plans`.

    Args:
        session: Database session.
    """

    def __init__(self, session: Session) -> None:
        self.session = session

    def list_plans(self, *, active_only: bool) -> list[Plan]:
        """Lists the catalog ordered by creation, so the oldest plan stays first.

        Args:
            active_only: When true, deactivated plans are left out — that is what
                a non-admin caller is allowed to see.

        Returns:
            The plans, newest last.
        """
        query = self.session.query(Plan)
        if active_only:
            query = query.filter(Plan.is_active.is_(True))
        return query.order_by(Plan.created_at, Plan.code).all()

    def get_by_id(self, plan_id: UUID) -> Plan | None:
        """Finds a plan by its id.

        Args:
            plan_id: Plan id.

        Returns:
            The plan, or `None` when it does not exist.
        """
        return self.session.get(Plan, plan_id)

    def get_by_code(self, code: str) -> Plan | None:
        """Finds a plan by its business key.

        Args:
            code: Plan code, already normalized to lowercase.

        Returns:
            The plan, or `None` when the code is free.
        """
        return self.session.query(Plan).filter(Plan.code == code).one_or_none()

    def add(self, plan: Plan) -> Plan:
        """Registers a new plan and flushes it so the id exists.

        Args:
            plan: Plan to persist.

        Returns:
            The persisted plan.
        """
        self.session.add(plan)
        self.session.flush()
        return plan

    def count_subscribers(self, plan_id: UUID) -> int:
        """Counts the subscriptions pointing at a plan.

        Args:
            plan_id: Plan id.

        Returns:
            How many subscriptions reference the plan.
        """
        return (
            self.session.query(func.count(Subscription.id))
            .filter(Subscription.plan_id == plan_id)
            .scalar()
            or 0
        )
