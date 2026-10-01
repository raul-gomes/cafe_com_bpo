from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.deadline import days_remaining, is_overdue
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.clients.models import Client
from src.modules.companies.models import Company
from src.modules.notifications.models import AppNotification
from src.modules.task_manager.models import Task
from src.modules.team.models import Team, TeamInvitation

from .schemas import (
    ActivityResponse,
    DashboardStats,
    DashboardSummary,
    PendingInvitation,
    UrgentTaskResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    current_user: CurrentUserDep, db: SessionDep
) -> DashboardSummary:
    """Aggregates what the panel landing page shows on its first paint.

    Args:
        current_user: The caller; every read is scoped to them.
        db: The database session.

    Returns:
        The greeting, the urgent tasks, the activity feed, the pending team
        invitations and the two sidebar counters.
    """
    # 1. Fetch urgent tasks
    now = datetime.now(timezone.utc)
    three_days_from_now = now + timedelta(days=3)

    tasks_query = (
        db.query(Task, Client.name.label("client_name"))
        .join(Client, Task.client_id == Client.id)
        .filter(
            and_(
                Task.user_id == current_user.id,
                Task.completed_at.is_(None),
                Task.is_cancelled == False,
                Task.is_active,
                Task.cancelled_at.is_(None),
                or_(Task.deadline <= three_days_from_now, Task.deadline < now),
            )
        )
        .order_by(Task.deadline.asc())
        .limit(10)
        .all()
    )

    # Fonte única da regra de prazo (`src/core/deadline.py`): a mesma que a
    # lista de tarefas e o front usam, para a mesma tarefa não ter três
    # vereditos diferentes.
    _compute_days_remaining = days_remaining
    _is_overdue = is_overdue

    urgent_tasks = [
        UrgentTaskResponse(
            id=t.Task.id,
            title=t.Task.title,
            client_name=t.client_name,
            deadline=t.Task.deadline,
            days_remaining=_compute_days_remaining(t.Task.deadline),
            is_overdue=_is_overdue(t.Task.deadline),
        )
        for t in tasks_query
    ]

    # 2. Fetch recent unread activities
    notifications_query = (
        db.query(
            AppNotification,
            User.name.label("triggerer_name"),
        )
        .outerjoin(User, AppNotification.triggered_by_user_id == User.id)
        .filter(
            AppNotification.user_id == current_user.id,
            AppNotification.is_read.is_(False),
        )
        .order_by(AppNotification.created_at.desc())
        .limit(20)
        .all()
    )

    activities = [
        ActivityResponse(
            id=n.AppNotification.id,
            type=n.AppNotification.type,
            created_at=n.AppNotification.created_at,
            is_read=n.AppNotification.is_read,
            post_id=(
                n.AppNotification.related_entity_id
                if n.AppNotification.related_entity_type == "discussion_post"
                else None
            ),
            triggered_by_name=n.triggerer_name,
            message_snippet=(
                n.AppNotification.message[:100] if n.AppNotification.message else None
            ),
        )
        for n in notifications_query
    ]

    # 3. Stats
    stats = DashboardStats(
        pending_tasks_count=db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.completed_at.is_(None),
            Task.is_cancelled == False,
            Task.is_active,
            Task.cancelled_at.is_(None),
        )
        .count(),
        # Counted on the table, not as `len(activities)`: the feed above is
        # capped at 20 rows, and the sidebar must show the real total.
        unread_notifications_count=db.query(AppNotification)
        .filter(
            AppNotification.user_id == current_user.id,
            AppNotification.is_read.is_(False),
        )
        .count(),
    )

    # 4. Pending team invitations for this user's email
    # The company name comes from `companies` (Fase 3, item 5), joined through
    # the team's `company_id`: `teams` is only ever linked to the company
    # facade now, so reaching for the legacy `clients` row here would break the
    # card the moment that row is gone.
    now = datetime.now(timezone.utc)
    pending_invitations = (
        db.query(
            TeamInvitation,
            Company.name.label("client_name"),
            User.name.label("inviter_name"),
        )
        .join(Team, Team.id == TeamInvitation.team_id)
        .join(Company, Company.id == Team.company_id)
        .join(User, User.id == TeamInvitation.invited_by)
        .filter(
            TeamInvitation.invited_email == current_user.email.strip().lower(),
            TeamInvitation.status == "pending",
            TeamInvitation.expires_at > now,
        )
        .order_by(TeamInvitation.created_at.desc())
        .all()
    )

    pending = [
        PendingInvitation(
            invitation_id=inv.id,
            client_name=client_name,
            inviter_name=inviter_name,
            created_at=inv.created_at,
        )
        for inv, client_name, inviter_name in pending_invitations
    ]

    return DashboardSummary(
        user_name=current_user.name,
        urgent_tasks=urgent_tasks,
        activities=activities,
        pending_invitations=pending,
        stats=stats,
    )
