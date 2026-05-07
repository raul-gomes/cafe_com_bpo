"""
Notifications Module - Service

Business logic for notification management.
Decoupled dispatcher architecture for future email/WhatsApp integration.
"""

from typing import List, Optional
from uuid import UUID

from src.modules.notifications.repository import NotificationRepository
from src.modules.notifications.schemas import NotificationCreate, NotificationUpdate, NotificationResponse
from src.core.logger import log


class NotificationDispatcher:
    """
    Abstract dispatcher interface for sending notifications.
    Currently in-app only. Future: add EmailDispatcher, WhatsAppDispatcher.
    """
    def __init__(self, repository: NotificationRepository):
        self.repository = repository

    def dispatch(self, user_id: UUID, title: str, message: str, notif_type: str,
                 related_entity_type: Optional[str] = None,
                 related_entity_id: Optional[UUID] = None) -> NotificationResponse:
        """Create and persist an in-app notification."""
        notif_data = NotificationCreate(
            title=title,
            message=message,
            type=notif_type,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
        )
        notif = self.repository.create(notif_data, user_id)
        log.info(f"🔔 Notificação criada: {title} para usuário {user_id}")
        return notif

    def dispatch_task_assigned(self, user_id: UUID, task_title: str, task_id: UUID) -> NotificationResponse:
        return self.dispatch(
            user_id,
            "Nova tarefa atribuída",
            f"A tarefa '{task_title}' foi atribuída a você.",
            "task_assigned",
            "task",
            task_id,
        )

    def dispatch_task_deadline(self, user_id: UUID, task_title: str, task_id: UUID) -> NotificationResponse:
        return self.dispatch(
            user_id,
            "Prazo da tarefa se aproxima",
            f"A tarefa '{task_title}' está perto do prazo.",
            "task_deadline",
            "task",
            task_id,
        )

    def dispatch_task_overdue(self, user_id: UUID, task_title: str, task_id: UUID) -> NotificationResponse:
        return self.dispatch(
            user_id,
            "Tarefa atrasada",
            f"A tarefa '{task_title}' está atrasada.",
            "task_overdue",
            "task",
            task_id,
        )


class NotificationService:
    """Service layer for notification operations."""

    def __init__(self, repository: NotificationRepository):
        self.repository = repository
        self.dispatcher = NotificationDispatcher(repository)

    def get_notifications(
        self,
        user_id: UUID,
        type_filter: Optional[str] = None,
        unread_only: bool = False,
    ) -> List[NotificationResponse]:
        """Get all notifications for a user."""
        return self.repository.get_by_user(user_id, type_filter, unread_only)

    def create_notification(self, notif_data: NotificationCreate, user_id: UUID) -> NotificationResponse:
        """Create a new notification."""
        return self.repository.create(notif_data, user_id)

    def mark_as_read(self, notif_id: UUID, user_id: UUID) -> NotificationResponse:
        """Mark a notification as read."""
        notif = self.repository.get_by_id(notif_id, user_id)
        if not notif:
            raise ValueError(f"Notification {notif_id} not found for user {user_id}")
        return self.repository.mark_as_read(notif)

    def mark_all_as_read(self, user_id: UUID) -> int:
        """Mark all notifications as read."""
        return self.repository.mark_all_as_read(user_id)

    def delete_notification(self, notif_id: UUID, user_id: UUID) -> None:
        """Delete a notification."""
        notif = self.repository.get_by_id(notif_id, user_id)
        if not notif:
            raise ValueError(f"Notification {notif_id} not found for user {user_id}")
        self.repository.delete(notif)

    def get_unread_count(self, user_id: UUID) -> int:
        """Get count of unread notifications."""
        return self.repository.count_unread(user_id)
