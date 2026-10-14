"""
Platform Module - Routers

Public reads (lessons, home post-its, login notice, next open café), the public
café attendance confirmation, and the administrator tools that edit all of it
plus the users list with courtesy grants.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.rate_limit import CAFE_RSVP_LIMIT, limiter
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user, require_admin

from . import service
from .models import Announcement, CafeRsvp, Lesson
from .schemas import (
    AdminAnnouncementResponse,
    AdminLessonResponse,
    AdminSiteResponse,
    AdminUserResponse,
    AnnouncementCreate,
    AnnouncementResponse,
    BetaGrantCreate,
    BetaResponse,
    CafeMeeting,
    CafeRsvpAccepted,
    CafeRsvpCreate,
    CafeRsvpResponse,
    CourtesyCreate,
    CourtesyResponse,
    LessonResponse,
    LessonWrite,
    LoginNotice,
    PublicCafeMeeting,
    PublicSiteResponse,
    RoleResponse,
    RoleUpdate,
)

router = APIRouter(tags=["platform"])
admin_router = APIRouter(prefix="/admin", tags=["admin"])

SessionDep = Annotated[Session, Depends(get_db_session)]
UserDep = Annotated[UserResponse, Depends(get_current_user)]
AdminDep = Annotated[UserResponse, Depends(require_admin)]


# ── Public and signed-in reads ─────────────────────────────────────────────


@router.get("/lessons", response_model=list[LessonResponse])
def list_published_lessons(_user: UserDep, db: SessionDep) -> list[Lesson]:
    """Published lessons of every Aulas section.

    Args:
        _user: Authenticated user.
        db: Database session.

    Returns:
        The lessons, ordered by section and position.
    """
    return service.list_lessons(db, include_drafts=False)


@router.get("/announcements/active", response_model=list[AnnouncementResponse])
def list_active_announcements(user: UserDep, db: SessionDep) -> list[Announcement]:
    """Post-its of the home panel for the signed-in user.

    Args:
        user: Authenticated user.
        db: Database session.

    Returns:
        The running announcements of the user's audience.
    """
    return service.active_announcements_for(db, db.get(User, user.id))


@router.get("/site/public", response_model=PublicSiteResponse)
def get_public_site(db: SessionDep) -> PublicSiteResponse:
    """Editable pieces of the public site (no login required).

    Args:
        db: Database session.

    Returns:
        The login notice and the next open café, without its link.
    """
    meeting = service.cafe_meeting(db)
    return PublicSiteResponse(
        login_notice=service.login_notice(db),
        cafe_meeting=PublicCafeMeeting(
            title=meeting.title,
            starts_at=service.meeting_start(meeting, datetime.now(UTC)),
            duration_minutes=meeting.duration_minutes,
        ),
    )


@router.post(
    "/cafes/rsvps", response_model=CafeRsvpAccepted, status_code=status.HTTP_201_CREATED
)
@limiter.limit(CAFE_RSVP_LIMIT)
def confirm_cafe_presence(
    request: Request, rsvp_in: CafeRsvpCreate, db: SessionDep
) -> CafeRsvpAccepted:
    """Public attendance confirmation for the next open café.

    Args:
        request: Incoming request (used by the rate limiter).
        rsvp_in: Name plus e-mail and/or phone.
        db: Database session.

    Returns:
        When the meeting happens and its link, once the team has set one.
    """
    meeting, starts = service.confirm_presence(db, rsvp_in)
    return CafeRsvpAccepted(
        title=meeting.title,
        starts_at=starts,
        duration_minutes=meeting.duration_minutes,
        meet_url=meeting.meet_url,
    )


# ── Administrator: lessons ─────────────────────────────────────────────────


@admin_router.get("/lessons", response_model=list[AdminLessonResponse])
def admin_list_lessons(_admin: AdminDep, db: SessionDep) -> list[Lesson]:
    """Every lesson, drafts included.

    Args:
        _admin: Authenticated administrator.
        db: Database session.

    Returns:
        The lessons.
    """
    return service.list_lessons(db, include_drafts=True)


@admin_router.post(
    "/lessons", response_model=AdminLessonResponse, status_code=status.HTTP_201_CREATED
)
def admin_create_lesson(data: LessonWrite, _admin: AdminDep, db: SessionDep) -> Lesson:
    """Creates a lesson.

    Args:
        data: Lesson fields.
        _admin: Authenticated administrator.
        db: Database session.

    Returns:
        The new lesson.
    """
    return service.save_lesson(db, data)


@admin_router.put("/lessons/{lesson_id}", response_model=AdminLessonResponse)
def admin_update_lesson(
    lesson_id: UUID, data: LessonWrite, _admin: AdminDep, db: SessionDep
) -> Lesson:
    """Replaces the fields of a lesson.

    Args:
        lesson_id: Lesson id.
        data: Lesson fields.
        _admin: Authenticated administrator.
        db: Database session.

    Returns:
        The edited lesson.
    """
    return service.save_lesson(db, data, service.get_lesson(db, lesson_id))


@admin_router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_lesson(lesson_id: UUID, _admin: AdminDep, db: SessionDep) -> None:
    """Deletes a lesson.

    Args:
        lesson_id: Lesson id.
        _admin: Authenticated administrator.
        db: Database session.
    """
    db.delete(service.get_lesson(db, lesson_id))
    db.commit()


# ── Administrator: announcements ───────────────────────────────────────────


@admin_router.get("/announcements", response_model=list[AdminAnnouncementResponse])
def admin_list_announcements(_admin: AdminDep, db: SessionDep) -> list[Announcement]:
    """Every announcement sent, newest first.

    Args:
        _admin: Authenticated administrator.
        db: Database session.

    Returns:
        The announcements.
    """
    return service.list_announcements(db)


@admin_router.post(
    "/announcements",
    response_model=AdminAnnouncementResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_send_announcement(
    data: AnnouncementCreate, admin: AdminDep, db: SessionDep
) -> Announcement:
    """Sends a message to the bell of every user in the audience.

    Args:
        data: Title, message, audience and post-it options.
        admin: Authenticated administrator (recorded as the author).
        db: Database session.

    Returns:
        The stored announcement, with how many people received it.
    """
    return service.create_announcement(db, data, author_id=admin.id)


@admin_router.delete(
    "/announcements/{announcement_id}", status_code=status.HTTP_204_NO_CONTENT
)
def admin_delete_announcement(
    announcement_id: UUID, _admin: AdminDep, db: SessionDep
) -> None:
    """Withdraws an announcement: the post-it and the bell notifications go away.

    Args:
        announcement_id: Announcement id.
        _admin: Authenticated administrator.
        db: Database session.
    """
    service.delete_announcement(db, announcement_id)


# ── Administrator: site settings and café ──────────────────────────────────


def _admin_site(db: Session) -> AdminSiteResponse:
    """Builds the admin view of the site settings.

    Args:
        db: Database session.

    Returns:
        The settings, with the computed start of the next meeting.
    """
    meeting = service.cafe_meeting(db)
    return AdminSiteResponse(
        login_notice=service.login_notice(db),
        cafe_meeting=meeting,
        next_meeting_starts_at=service.meeting_start(meeting, datetime.now(UTC)),
    )


@admin_router.get("/site", response_model=AdminSiteResponse)
def admin_get_site(_admin: AdminDep, db: SessionDep) -> AdminSiteResponse:
    """Site settings the admin page edits.

    Args:
        _admin: Authenticated administrator.
        db: Database session.

    Returns:
        The settings.
    """
    return _admin_site(db)


@admin_router.put("/site/login-notice", response_model=AdminSiteResponse)
def admin_save_login_notice(
    data: LoginNotice, admin: AdminDep, db: SessionDep
) -> AdminSiteResponse:
    """Saves the message of the login window.

    Args:
        data: Title, message and optional link.
        admin: Authenticated administrator.
        db: Database session.

    Returns:
        The updated settings.
    """
    service.save_login_notice(db, data, editor=admin.email)
    return _admin_site(db)


@admin_router.put("/site/cafe-meeting", response_model=AdminSiteResponse)
def admin_save_cafe_meeting(
    data: CafeMeeting, admin: AdminDep, db: SessionDep
) -> AdminSiteResponse:
    """Saves the open café settings (title, Meet link, optional date).

    Args:
        data: Meeting settings.
        admin: Authenticated administrator.
        db: Database session.

    Returns:
        The updated settings.
    """
    service.save_cafe_meeting(db, data, editor=admin.email)
    return _admin_site(db)


# Admin lists answer an array (the screen's contract) and the full count in
# this header, so a cut list is flagged and the export can ask for all (AUD-044).
TOTAL_COUNT_HEADER = "X-Total-Count"
ADMIN_LIST_MAX = 20000


@admin_router.get("/cafes/rsvps", response_model=list[CafeRsvpResponse])
def admin_list_rsvps(
    _admin: AdminDep,
    db: SessionDep,
    response: Response,
    limit: Annotated[int, Query(ge=1, le=ADMIN_LIST_MAX)] = 500,
) -> list[CafeRsvp]:
    """Attendance confirmations of the open cafés.

    Args:
        _admin: Authenticated administrator.
        db: Database session.
        response: Outgoing response (carries the total).
        limit: Most confirmations to return.

    Returns:
        The confirmations; the total goes in `X-Total-Count`.
    """
    rows, total = service.list_rsvps(db, limit=limit)
    response.headers[TOTAL_COUNT_HEADER] = str(total)
    return rows


# ── Administrator: users and courtesy ──────────────────────────────────────


@admin_router.get("/users", response_model=list[AdminUserResponse])
def admin_list_users(
    _admin: AdminDep,
    db: SessionDep,
    response: Response,
    search: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=ADMIN_LIST_MAX)] = 300,
) -> list[dict]:
    """Users with their current access (newest first, 300 by default).

    Args:
        _admin: Authenticated administrator.
        db: Database session.
        response: Outgoing response (carries the total).
        search: Optional piece of name or e-mail.
        limit: Most users to return.

    Returns:
        The users; how many match in all goes in `X-Total-Count`.
    """
    rows, total = service.list_users(db, search=search, limit=limit)
    response.headers[TOTAL_COUNT_HEADER] = str(total)
    return rows


@admin_router.post(
    "/users/{user_id}/courtesy",
    response_model=CourtesyResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_grant_courtesy(
    user_id: UUID, data: CourtesyCreate, admin: AdminDep, db: SessionDep
):
    """Gives a user free full access for some days (replaces a running one).

    Args:
        user_id: User who receives it.
        data: Days and reason.
        admin: Authenticated administrator.
        db: Database session.

    Returns:
        The new courtesy.
    """
    return service.grant_courtesy(db, user_id, data, granted_by=admin.email)


@admin_router.delete("/courtesies/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_revoke_courtesy(grant_id: UUID, _admin: AdminDep, db: SessionDep) -> None:
    """Ends a courtesy now.

    Args:
        grant_id: Courtesy id.
        _admin: Authenticated administrator.
        db: Database session.
    """
    service.revoke_courtesy(db, grant_id)


@admin_router.post(
    "/users/{user_id}/beta",
    response_model=BetaResponse,
    status_code=status.HTTP_201_CREATED,
)
def admin_grant_beta(
    user_id: UUID, data: BetaGrantCreate, admin: AdminDep, db: SessionDep
):
    """Promotes a user to the beta access for some days (replaces a running one).

    Args:
        user_id: User who receives it.
        data: Number of days.
        admin: Authenticated administrator.
        db: Database session.

    Returns:
        The running beta access.
    """
    return service.grant_beta(db, user_id, data, granted_by=admin.email)


@admin_router.delete("/users/{user_id}/beta", status_code=status.HTTP_204_NO_CONTENT)
def admin_revoke_beta(user_id: UUID, _admin: AdminDep, db: SessionDep) -> None:
    """Ends a user's beta access now.

    Args:
        user_id: User who loses it.
        _admin: Authenticated administrator.
        db: Database session.
    """
    service.revoke_beta(db, user_id)


@admin_router.patch("/users/{user_id}/role", response_model=RoleResponse)
def admin_set_user_role(
    user_id: UUID, data: RoleUpdate, admin: AdminDep, db: SessionDep
):
    """Promotes a user to administrator or demotes them back to user.

    Args:
        user_id: User whose role changes.
        data: The new role (`admin` or `user`).
        admin: Authenticated administrator performing the change.
        db: Database session.

    Returns:
        The id and the new role.
    """
    return service.set_user_role(db, user_id, data, actor_id=admin.id)
