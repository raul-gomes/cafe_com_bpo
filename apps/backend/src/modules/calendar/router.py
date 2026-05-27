"""
Calendar sync endpoints (skeleton).

POST /calendar/sync      — Sync selected tasks to Google Calendar
GET  /calendar/auth-url   — Get Google OAuth authorization URL
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated

from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .schemas import CalendarSyncRequest, CalendarSyncResponse, CalendarAuthUrlResponse
from .service import GoogleCalendarService

router = APIRouter(prefix="/calendar", tags=["calendar"])


def get_calendar_service() -> GoogleCalendarService:
    return GoogleCalendarService()


CalendarServiceDep = Annotated[GoogleCalendarService, Depends(get_calendar_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/auth-url", response_model=CalendarAuthUrlResponse)
def get_auth_url(service: CalendarServiceDep):
    """Get the Google OAuth2 authorization URL for Calendar scope."""
    url = service.get_auth_url()
    if not url:
        raise HTTPException(
            status_code=501,
            detail="Google Calendar não configurado. Configure GOOGLE_CALENDAR_CLIENT_ID.",
        )
    return CalendarAuthUrlResponse(auth_url=url)


@router.post("/sync", response_model=CalendarSyncResponse)
def sync_tasks(
    request: CalendarSyncRequest,
    service: CalendarServiceDep,
    current_user: CurrentUserDep,
):
    """Sync selected tasks to Google Calendar."""
    if not request.task_ids:
        raise HTTPException(status_code=400, detail="Nenhuma tarefa selecionada.")

    result = service.sync_tasks_to_calendar(
        user_id=current_user.id, task_ids=request.task_ids
    )
    log.info(
        f"Calendar sync for user {current_user.email}: "
        f"{result['synced']} synced, {result['failed']} failed"
    )
    return CalendarSyncResponse(**result)
