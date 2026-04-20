from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta, timezone
from typing import Annotated

from src.core.database import get_db_session
from src.modules.auth.service import get_current_user
from src.modules.auth.schemas import UserResponse
from src.modules.auth.models import User
from src.modules.tasks.models import Task
from src.modules.clients.models import Client
from src.modules.network.models import Notification, DiscussionComment
from .schemas import DashboardSummary, UrgentTaskResponse, ActivityResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]
SessionDep = Annotated[Session, Depends(get_db_session)]

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    current_user: CurrentUserDep,
    db: SessionDep
):
    # 1. Fetch urgent tasks
    now = datetime.now(timezone.utc)
    three_days_from_now = now + timedelta(days=3)
    
    tasks_query = db.query(Task, Client.name.label("client_name")).join(
        Client, Task.client_id == Client.id
    ).filter(
        and_(
            Task.user_id == current_user.id,
            Task.status != "done",
            Task.deleted_at.is_(None),
            or_(
                Task.deadline <= three_days_from_now,
                Task.deadline < now
            )
        )
    ).order_by(Task.deadline.asc()).limit(10).all()
    
    urgent_tasks = [
        UrgentTaskResponse(
            id=t.Task.id,
            title=t.Task.title,
            client_name=t.client_name,
            deadline=t.Task.deadline,
            priority=t.Task.priority,
            status=t.Task.status
        ) for t in tasks_query
    ]
    
    # 2. Fetch recent unread activities
    notifications_query = db.query(
        Notification, 
        User.name.label("triggerer_name"),
        DiscussionComment.message.label("comment_message")
    ).join(
        User, Notification.triggered_by_user_id == User.id
    ).outerjoin(
        DiscussionComment, Notification.comment_id == DiscussionComment.id
    ).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).order_by(Notification.created_at.desc()).limit(20).all()
    
    activities = [
        ActivityResponse(
            id=n.Notification.id,
            type=n.Notification.type,
            created_at=n.Notification.created_at,
            is_read=n.Notification.is_read,
            post_id=n.Notification.post_id,
            comment_id=n.Notification.comment_id,
            triggered_by_name=n.triggerer_name,
            message_snippet=n.comment_message[:100] if n.comment_message else None
        ) for n in notifications_query
    ]
    
    # 3. Stats
    stats = {
        "pending_tasks_count": db.query(Task).filter(
            Task.user_id == current_user.id, 
            Task.status != "done",
            Task.deleted_at.is_(None)
        ).count(),
        "unread_notifications_count": len(activities)
    }
    
    return DashboardSummary(
        user_name=current_user.name,
        urgent_tasks=urgent_tasks,
        activities=activities,
        stats=stats
    )
