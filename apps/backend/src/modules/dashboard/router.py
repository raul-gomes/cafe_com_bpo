from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.clients.models import Client
from src.modules.network.models import DiscussionComment, Notification
from src.modules.task_manager.models import Task
from src.modules.team.models import Team, TeamInvitation

from .schemas import (
    ActivityResponse,
    DashboardSummary,
    PendingInvitation,
    UrgentTaskResponse,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
SessionDep = Annotated[Session, Depends(get_db_session)]


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(current_user: CurrentUserDep, db: SessionDep):
    # 1. Fetch urgent tasks
    now = datetime.now(timezone.utc)
    three_days_from_now = now + timedelta(days=3)

    tasks_query = (
        db.query(Task, Client.name.label("client_name"))
        .join(Client, Task.client_id == Client.id)
        .filter(
            and_(
                Task.user_id == current_user.id,
                Task.status != "done",
                Task.status != "cancelled",
                Task.is_active,
                Task.cancelled_at.is_(None),
                or_(Task.deadline <= three_days_from_now, Task.deadline < now),
            )
        )
        .order_by(Task.deadline.asc())
        .limit(10)
        .all()
    )

    def _compute_days_remaining(deadline: datetime | None) -> int | None:
        if deadline is None:
            return None
        now = datetime.now(timezone.utc)
        # Normalize: assume UTC if deadline has no tzinfo (e.g. SQLite)
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        diff = (deadline - now).days
        return diff

    def _is_overdue(deadline: datetime | None) -> bool:
        if deadline is None:
            return False
        now = datetime.now(timezone.utc)
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return deadline < now

    urgent_tasks = [
        UrgentTaskResponse(
            id=t.Task.id,
            title=t.Task.title,
            client_name=t.client_name,
            deadline=t.Task.deadline,
            priority=t.Task.priority,
            status=t.Task.status,
            days_remaining=_compute_days_remaining(t.Task.deadline),
            is_overdue=_is_overdue(t.Task.deadline),
        )
        for t in tasks_query
    ]

    # 2. Fetch recent unread activities
    notifications_query = (
        db.query(
            Notification,
            User.name.label("triggerer_name"),
            DiscussionComment.message.label("comment_message"),
        )
        .join(User, Notification.triggered_by_user_id == User.id)
        .outerjoin(DiscussionComment, Notification.comment_id == DiscussionComment.id)
        .filter(
            Notification.user_id == current_user.id, Notification.is_read.is_(False)
        )
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )

    activities = [
        ActivityResponse(
            id=n.Notification.id,
            type=n.Notification.type,
            created_at=n.Notification.created_at,
            is_read=n.Notification.is_read,
            post_id=n.Notification.post_id,
            comment_id=n.Notification.comment_id,
            triggered_by_name=n.triggerer_name,
            message_snippet=n.comment_message[:100] if n.comment_message else None,
        )
        for n in notifications_query
    ]

    # 3. Stats
    stats = {
        "pending_tasks_count": db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.status != "done",
            Task.status != "cancelled",
            Task.is_active,
            Task.cancelled_at.is_(None),
        )
        .count(),
        "unread_notifications_count": len(activities),
    }

    # 4. Pending team invitations for this user's email
    now = datetime.now(timezone.utc)
    pending_invitations = (
        db.query(
            TeamInvitation,
            Client.id.label("client_id"),
            Client.name.label("client_name"),
            User.name.label("inviter_name"),
        )
        .join(Team, Team.id == TeamInvitation.team_id)
        .join(Client, Client.id == Team.client_id)
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
            client_id=client_id,
            client_name=client_name,
            inviter_name=inviter_name,
            created_at=inv.created_at,
            expires_at=inv.expires_at,
        )
        for inv, client_id, client_name, inviter_name in pending_invitations
    ]

    return DashboardSummary(
        user_name=current_user.name,
        urgent_tasks=urgent_tasks,
        activities=activities,
        pending_invitations=pending,
        stats=stats,
    )
