"""Business rules of the plan catalog.

The admin Config screen is the only writer of `plans`. Two rules live here and
not in the router, because a router check is bypassed the moment another caller
appears (checkout, a job, a script):

- **§17.1 — the price is edited by an admin.** A non-admin gets 403 even if it
  reaches the service directly.
- **The code is frozen.** It is the business key `subscriptions.plan_id` points
  at; renaming it would repoint what people were sold.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.modules.auth.schemas import UserResponse
from src.modules.subscriptions.models import Plan
from src.modules.subscriptions.repository import PlanRepository
from src.modules.subscriptions.schemas import PlanCreate, PlanResponse, PlanUpdate

ROLE_ADMIN = "admin"


class PlanService:
    """Reads and writes the plan catalog on behalf of an authenticated actor.

    Args:
        session: Database session.
    """

    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = PlanRepository(session)

    def list_plans(self, actor: UserResponse) -> list[PlanResponse]:
        """Lists what the actor is allowed to see in the catalog.

        A deactivated plan is out of the catalog for everyone but the admin: the
        checkout reads this same answer, so an archived plan must never be
        offered to somebody who could subscribe to it.

        Args:
            actor: Authenticated user.

        Returns:
            The plans visible to the actor.
        """
        is_admin = actor.role == ROLE_ADMIN
        return [
            self._to_response(plan)
            for plan in self.repo.list_plans(active_only=not is_admin)
        ]

    def create_plan(self, actor: UserResponse, data: PlanCreate) -> PlanResponse:
        """Creates a plan.

        Args:
            actor: Authenticated user; only an admin may write.
            data: Validated body.

        Returns:
            The created plan.

        Raises:
            HTTPException: 403 when the actor is not an admin, 409 when the code
                is already taken.
        """
        self._require_admin(actor)
        if self.repo.get_by_code(data.code) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um plano com este código",
            )

        plan = Plan(
            code=data.code,
            name=data.name,
            price=data.price,
            cycle=data.cycle,
            description=data.description,
            is_active=data.is_active,
        )
        try:
            self.repo.add(plan)
            self.session.commit()
        except IntegrityError:
            # Two admins saving the same code at once: the unique index is the
            # real arbiter, the check above is only the friendly error.
            self.session.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe um plano com este código",
            ) from None

        self.session.refresh(plan)
        return self._to_response(plan)

    def update_plan(
        self, actor: UserResponse, plan_id: UUID, data: PlanUpdate
    ) -> PlanResponse:
        """Edits the commercial attributes of a plan.

        Args:
            actor: Authenticated user; only an admin may write.
            plan_id: Plan to edit.
            data: Validated body; only the fields sent are written.

        Returns:
            The updated plan.

        Raises:
            HTTPException: 403 when the actor is not an admin, 404 when the plan
                does not exist.
        """
        self._require_admin(actor)
        plan = self.repo.get_by_id(plan_id)
        if plan is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Plano não encontrado"
            )

        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(plan, field, value)
        self.session.commit()
        self.session.refresh(plan)
        return self._to_response(plan)

    @staticmethod
    def _require_admin(actor: UserResponse) -> None:
        """Enforces §17.1: only an admin edits the catalog.

        Args:
            actor: Authenticated user.

        Raises:
            HTTPException: 403 when the actor is not an admin.
        """
        if actor.role != ROLE_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso restrito a administradores",
            )

    def _to_response(self, plan: Plan) -> PlanResponse:
        """Adapts a `Plan` row to the catalog contract.

        The price is a string, the same way `GET /access` renders it, so the two
        screens can never disagree about how much the plan costs.

        Args:
            plan: Plan row.

        Returns:
            The response body.
        """
        return PlanResponse(
            id=str(plan.id),
            code=plan.code,
            name=plan.name,
            price=str(plan.price),
            cycle=plan.cycle,
            is_active=plan.is_active,
            description=plan.description,
            subscriber_count=self.repo.count_subscribers(plan.id),
        )
