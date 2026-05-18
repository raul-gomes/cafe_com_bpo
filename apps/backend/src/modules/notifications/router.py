"""
Notifications Module - Router

API endpoints for notification management.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Annotated, List, Optional
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .schemas import NotificationCreate, NotificationResponse, UnreadCountResponse
from .repository import NotificationRepository
from .service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])


def get_repo(
    session: Annotated[Session, Depends(get_db_session)],
) -> NotificationRepository:
    return NotificationRepository(session)


def get_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> NotificationService:
    return NotificationService(NotificationRepository(session))


RepoDep = Annotated[NotificationRepository, Depends(get_repo)]
ServiceDep = Annotated[NotificationService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post(
    "/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED
)
def create_notification(
    notif_in: NotificationCreate, service: ServiceDep, current_user: CurrentUserDep
):
    """Cria uma nova notificação para o usuário atual."""
    new_notif = service.create_notification(notif_in, current_user.id)
    log.info(
        f"🔔 Notificação criada: {notif_in.title} por usuário {current_user.email}"
    )
    return new_notif


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    service: ServiceDep,
    current_user: CurrentUserDep,
    type: Optional[str] = Query(None, description="Filter by notification type"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
):
    """Retorna notificações do usuário atual."""
    return service.get_notifications(current_user.id, type, unread_only)


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(service: ServiceDep, current_user: CurrentUserDep):
    """Retorna contagem de notificações não lidas."""
    return {"count": service.get_unread_count(current_user.id)}


@router.put("/{notif_id}/read", response_model=NotificationResponse)
def mark_as_read(notif_id: UUID, service: ServiceDep, current_user: CurrentUserDep):
    """Marca uma notificação como lida."""
    try:
        return service.mark_as_read(notif_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")


@router.post("/mark-all-read")
def mark_all_as_read(service: ServiceDep, current_user: CurrentUserDep):
    """Marca todas as notificações como lidas."""
    count = service.mark_all_as_read(current_user.id)
    return {"marked": count}


@router.delete("/{notif_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notif_id: UUID, service: ServiceDep, current_user: CurrentUserDep
):
    """Remove uma notificação."""
    try:
        service.delete_notification(notif_id, current_user.id)
        log.info(f"🗑️ Notificação excluída: {notif_id} por {current_user.email}")
    except ValueError:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return None
