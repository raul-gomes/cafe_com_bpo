"""
Notifications Module - Repository

Data access layer for notifications.
"""
# ruff: noqa: E712 - SQLAlchemy requires == False for boolean column comparisons

from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone

from .models import AppNotification
from .schemas import NotificationCreate


class NotificationRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, notif_id: UUID, user_id: UUID) -> Optional[AppNotification]:
        """Get a specific notification for a user."""
        return (
            self.session.query(AppNotification)
            .filter(AppNotification.id == notif_id, AppNotification.user_id == user_id)
            .first()
        )

    def get_by_user(
        self,
        user_id: UUID,
        type_filter: Optional[str] = None,
        unread_only: bool = False,
    ) -> List[AppNotification]:
        """Get all notifications for a user, optionally filtered."""
        query = self.session.query(AppNotification).filter(
            AppNotification.user_id == user_id
        )
        if type_filter:
            query = query.filter(AppNotification.type == type_filter)
        if unread_only:
            query = query.filter(AppNotification.is_read == False)
        return query.order_by(
            AppNotification.created_at.desc(), AppNotification.id.desc()
        ).all()

    def create(self, notif_in: NotificationCreate, user_id: UUID) -> AppNotification:
        """Create a new notification."""
        notif_data = notif_in.model_dump()
        new_notif = AppNotification(**notif_data, user_id=user_id)
        self.session.add(new_notif)
        self.session.commit()
        self.session.refresh(new_notif)
        return new_notif

    def mark_as_read(self, notif: AppNotification) -> AppNotification:
        """Mark a notification as read."""
        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(notif)
        return notif

    def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications for a user as read. Returns count."""
        unread = (
            self.session.query(AppNotification)
            .filter(
                AppNotification.user_id == user_id, AppNotification.is_read == False
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for n in unread:
            n.is_read = True
            n.read_at = now
        self.session.commit()
        return len(unread)

    def delete(self, notif: AppNotification) -> None:
        """Delete a notification."""
        self.session.delete(notif)
        self.session.commit()

    def count_unread(self, user_id: UUID) -> int:
        """Count unread notifications for a user."""
        return (
            self.session.query(AppNotification)
            .filter(
                AppNotification.user_id == user_id, AppNotification.is_read == False
            )
            .count()
        )
