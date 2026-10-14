"""Business rules of the platform content (lessons, announcements, settings)."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.core.entitlements import ROLE_ADMIN, AccessState, resolve_access
from src.core.time_utils import as_utc
from src.modules.auth.models import User
from src.modules.notifications.models import AppNotification
from src.modules.subscriptions.models import (
    BETA_SOURCE_ADMIN,
    BetaAccess,
    CourtesyGrant,
)

from .models import Announcement, CafeRsvp, Lesson, SiteSetting
from .rules import next_open_cafe, youtube_id_from
from .schemas import (
    AnnouncementCreate,
    BetaGrantCreate,
    CafeMeeting,
    CafeRsvpCreate,
    CourtesyCreate,
    LessonWrite,
    LoginNotice,
    RoleUpdate,
)

LOGIN_NOTICE_KEY = "login_notice"
CAFE_MEETING_KEY = "cafe_meeting"

#: What the login window says until an administrator edits it.
DEFAULT_LOGIN_NOTICE = LoginNotice(
    title="Bem-vindo de volta.",
    message="Seu escritório de BPO em um lugar só.",
)

#: Access states counted as "paying" when an announcement targets payers.
PAYING_STATES = (AccessState.ACTIVE, AccessState.PAST_DUE)

ANNOUNCEMENT_NOTIFICATION_TYPE = "announcement"


def _not_found(what: str) -> HTTPException:
    """Builds the 404 of a missing row.

    Args:
        what: Name of the missing thing, in Portuguese (shown to the admin).

    Returns:
        The exception to raise.
    """
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} não encontrado."
    )


# ── Lessons ────────────────────────────────────────────────────────────────


def list_lessons(session: Session, *, include_drafts: bool) -> list[Lesson]:
    """Lessons ordered by section and position.

    Args:
        session: Database session.
        include_drafts: Whether unpublished lessons are included (admin page).

    Returns:
        The lessons.
    """
    query = select(Lesson).order_by(Lesson.section, Lesson.position, Lesson.created_at)
    if not include_drafts:
        query = query.where(Lesson.is_published.is_(True))
    return list(session.scalars(query).all())


def save_lesson(
    session: Session, data: LessonWrite, lesson: Lesson | None = None
) -> Lesson:
    """Creates a lesson, or overwrites an existing one with the new fields.

    Args:
        session: Database session.
        data: Validated lesson fields.
        lesson: Lesson to edit; `None` creates a new one.

    Returns:
        The stored lesson.
    """
    if lesson is None:
        lesson = Lesson()
        session.add(lesson)
    for field, value in data.model_dump().items():
        setattr(lesson, field, value)
    lesson.youtube_id = youtube_id_from(data.video_url) if data.video_url else None
    session.commit()
    session.refresh(lesson)
    return lesson


def get_lesson(session: Session, lesson_id: UUID) -> Lesson:
    """Loads a lesson or fails with 404.

    Args:
        session: Database session.
        lesson_id: Lesson id.

    Returns:
        The lesson.

    Raises:
        HTTPException: 404 when it does not exist.
    """
    lesson = session.get(Lesson, lesson_id)
    if lesson is None:
        raise _not_found("Aula")
    return lesson


# ── Announcements ──────────────────────────────────────────────────────────


def _in_audience(session: Session, user: User, audience: str, now: datetime) -> bool:
    """Whether a user is one of the recipients of an announcement.

    Administrators always receive it, so whoever sends can see how it looks.

    Args:
        session: Database session.
        user: Candidate recipient.
        audience: all | paying | free.
        now: Instant to resolve the access against.

    Returns:
        True when the user belongs to the audience.
    """
    if audience == "all" or user.role == "admin":
        return True
    is_paying = resolve_access(session, user, now=now).state in PAYING_STATES
    return is_paying if audience == "paying" else not is_paying


def create_announcement(
    session: Session, data: AnnouncementCreate, *, author_id: UUID
) -> Announcement:
    """Stores an announcement and drops it in each recipient's bell.

    Args:
        session: Database session.
        data: Validated announcement.
        author_id: Administrator who sent it.

    Returns:
        The stored announcement, with the recipient count.
    """
    now = datetime.now(UTC)
    announcement = Announcement(**data.model_dump(), created_by_user_id=author_id)
    session.add(announcement)
    session.flush()

    users = session.scalars(select(User)).all()
    recipients = [u for u in users if _in_audience(session, u, data.audience, now)]
    session.add_all(
        AppNotification(
            user_id=user.id,
            title=data.title,
            message=data.message,
            type=ANNOUNCEMENT_NOTIFICATION_TYPE,
            related_entity_type=ANNOUNCEMENT_NOTIFICATION_TYPE,
            related_entity_id=announcement.id,
            triggered_by_user_id=author_id,
        )
        for user in recipients
    )
    announcement.recipients_count = len(recipients)
    session.commit()
    session.refresh(announcement)
    return announcement


def list_announcements(session: Session) -> list[Announcement]:
    """Every announcement, newest first (admin page).

    Args:
        session: Database session.

    Returns:
        The announcements.
    """
    return list(
        session.scalars(
            select(Announcement).order_by(Announcement.created_at.desc())
        ).all()
    )


def active_announcements_for(session: Session, user: User) -> list[Announcement]:
    """Post-its the home panel shows to this user right now.

    Args:
        session: Database session.
        user: Authenticated user.

    Returns:
        Announcements marked for the home panel, not expired, in the user's
        audience; newest first.
    """
    now = datetime.now(UTC)
    # Expiry and audience go in the query, before the limit: filtering after it
    # let 20 newer hidden announcements push a valid one out (AUD-033).
    audiences = [
        a for a in ("all", "paying", "free") if _in_audience(session, user, a, now)
    ]
    return list(
        session.scalars(
            select(Announcement)
            .where(
                Announcement.show_on_home.is_(True),
                or_(Announcement.expires_at.is_(None), Announcement.expires_at > now),
                Announcement.audience.in_(audiences),
            )
            .order_by(Announcement.created_at.desc())
            .limit(20)
        ).all()
    )


def delete_announcement(session: Session, announcement_id: UUID) -> None:
    """Removes an announcement and the bell notifications it created.

    Args:
        session: Database session.
        announcement_id: Announcement id.

    Raises:
        HTTPException: 404 when it does not exist.
    """
    announcement = session.get(Announcement, announcement_id)
    if announcement is None:
        raise _not_found("Aviso")
    session.query(AppNotification).filter(
        AppNotification.related_entity_type == ANNOUNCEMENT_NOTIFICATION_TYPE,
        AppNotification.related_entity_id == announcement_id,
    ).delete(synchronize_session=False)
    session.delete(announcement)
    session.commit()


# ── Site settings ──────────────────────────────────────────────────────────


def _setting(session: Session, key: str) -> dict | None:
    """Raw stored value of a setting.

    Args:
        session: Database session.
        key: Setting key.

    Returns:
        The stored JSON, or `None` when it was never edited.
    """
    row = session.get(SiteSetting, key)
    return row.value if row else None


def _save_setting(session: Session, key: str, value: dict, *, editor: str) -> None:
    """Creates or overwrites a setting.

    Args:
        session: Database session.
        key: Setting key.
        value: JSON value.
        editor: E-mail of the administrator who edited it.
    """
    row = session.get(SiteSetting, key)
    if row is None:
        row = SiteSetting(key=key)
        session.add(row)
    row.value = value
    row.updated_by = editor
    session.commit()


def login_notice(session: Session) -> LoginNotice:
    """The message of the login window (default until edited).

    Args:
        session: Database session.

    Returns:
        The notice.
    """
    stored = _setting(session, LOGIN_NOTICE_KEY)
    return LoginNotice.model_validate(stored) if stored else DEFAULT_LOGIN_NOTICE


def save_login_notice(
    session: Session, notice: LoginNotice, *, editor: str
) -> LoginNotice:
    """Stores the login window message.

    Args:
        session: Database session.
        notice: Validated notice.
        editor: Administrator e-mail.

    Returns:
        The stored notice.
    """
    _save_setting(
        session, LOGIN_NOTICE_KEY, notice.model_dump(mode="json"), editor=editor
    )
    return notice


def cafe_meeting(session: Session) -> CafeMeeting:
    """The open café as configured (defaults until edited).

    Args:
        session: Database session.

    Returns:
        The meeting settings.
    """
    stored = _setting(session, CAFE_MEETING_KEY)
    return CafeMeeting.model_validate(stored) if stored else CafeMeeting()


def save_cafe_meeting(
    session: Session, meeting: CafeMeeting, *, editor: str
) -> CafeMeeting:
    """Stores the open café settings.

    Args:
        session: Database session.
        meeting: Validated settings.
        editor: Administrator e-mail.

    Returns:
        The stored settings.
    """
    _save_setting(
        session, CAFE_MEETING_KEY, meeting.model_dump(mode="json"), editor=editor
    )
    return meeting


def meeting_start(meeting: CafeMeeting, now: datetime) -> datetime:
    """When the next open café starts.

    A date set by the administrator wins while it is still ahead (or under
    way); once it is over, the default rule takes over again, so the page never
    announces a meeting that already happened.

    Args:
        meeting: Configured settings.
        now: Reference instant (aware).

    Returns:
        The start instant, in UTC.
    """
    if meeting.starts_at is not None:
        starts = as_utc(meeting.starts_at)
        if starts + timedelta(minutes=meeting.duration_minutes) > now:
            return starts
    return next_open_cafe(now)


# ── Café attendance ────────────────────────────────────────────────────────


def confirm_presence(
    session: Session, data: CafeRsvpCreate
) -> tuple[CafeMeeting, datetime]:
    """Stores an attendance confirmation for the next open café.

    The same person confirming twice for the same meeting (same e-mail or
    phone) keeps one row.

    Args:
        session: Database session.
        data: Validated confirmation.

    Returns:
        The meeting settings and its start instant.
    """
    meeting = cafe_meeting(session)
    starts = meeting_start(meeting, datetime.now(UTC))
    if data.website:  # bot: answer as usual, store nothing
        return meeting, starts

    contact = (
        CafeRsvp.email == data.email if data.email else CafeRsvp.phone == data.phone
    )
    existing = session.scalars(
        select(CafeRsvp).where(CafeRsvp.meeting_starts_at == starts, contact)
    ).first()
    rsvp = existing or CafeRsvp(meeting_starts_at=starts)
    rsvp.name = data.name
    rsvp.email = data.email or rsvp.email
    rsvp.phone = data.phone or rsvp.phone
    session.add(rsvp)
    session.commit()
    return meeting, starts


def list_rsvps(session: Session, *, limit: int = 500) -> tuple[list[CafeRsvp], int]:
    """Confirmations, next meetings first and newest confirmations first.

    Args:
        session: Database session.
        limit: Most rows to return.

    Returns:
        Up to `limit` confirmations and how many exist in all, so the screen
        and the export can tell when the list is cut (AUD-044).
    """
    total = session.scalar(select(func.count()).select_from(CafeRsvp)) or 0
    rows = list(
        session.scalars(
            select(CafeRsvp)
            .order_by(CafeRsvp.meeting_starts_at.desc(), CafeRsvp.created_at.desc())
            .limit(limit)
        ).all()
    )
    return rows, total


# ── Users and courtesy ─────────────────────────────────────────────────────


def list_users(
    session: Session, *, search: str | None, limit: int = 300
) -> tuple[list[dict], int]:
    """Users with their resolved access, for the admin users page.

    Args:
        session: Database session.
        search: Optional piece of name or e-mail.
        limit: Most users to return (newest first).

    Returns:
        One dict per user, in the shape of `AdminUserResponse`, and how many
        users match in all, so a cut list is never taken as complete (AUD-044).
    """
    from src.core.entitlements import running_courtesy

    now = datetime.now(UTC)
    query = select(User)
    if search:
        like = f"%{search.strip().lower()}%"
        query = query.where((User.email.ilike(like)) | (User.name.ilike(like)))
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    query = query.order_by(User.created_at.desc()).limit(limit)
    rows = []
    for user in session.scalars(query).all():
        access = resolve_access(session, user, now=now)
        courtesy = running_courtesy(session, user_id=user.id, now=now)
        rows.append(
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "role": user.role,
                "created_at": user.created_at,
                "access_state": access.state.value,
                "access_expires_at": access.expires_at,
                "courtesy": courtesy,
            }
        )
    return rows, total


def grant_courtesy(
    session: Session, user_id: UUID, data: CourtesyCreate, *, granted_by: str
) -> CourtesyGrant:
    """Gives a user free full access for a number of days.

    A running courtesy is replaced (revoked now, new one from today), so the
    administrator can extend or shorten it with one action.

    Args:
        session: Database session.
        user_id: User who receives it.
        data: Days and reason.
        granted_by: Administrator e-mail.

    Returns:
        The new grant.

    Raises:
        HTTPException: 404 when the user does not exist.
    """
    if session.get(User, user_id) is None:
        raise _not_found("Usuário")
    now = datetime.now(UTC)
    session.query(CourtesyGrant).filter(
        CourtesyGrant.user_id == user_id, CourtesyGrant.revoked_at.is_(None)
    ).update({CourtesyGrant.revoked_at: now}, synchronize_session=False)
    grant = CourtesyGrant(
        user_id=user_id,
        granted_at=now,
        expires_at=now + timedelta(days=data.days),
        reason=data.reason,
        granted_by=granted_by,
    )
    session.add(grant)
    session.commit()
    session.refresh(grant)
    return grant


def revoke_courtesy(session: Session, grant_id: UUID) -> None:
    """Ends a courtesy now.

    Args:
        session: Database session.
        grant_id: Grant id.

    Raises:
        HTTPException: 404 when it does not exist.
    """
    grant = session.get(CourtesyGrant, grant_id)
    if grant is None:
        raise _not_found("Cortesia")
    grant.revoked_at = datetime.now(UTC)
    session.commit()


def grant_beta(
    session: Session, user_id: UUID, data: BetaGrantCreate, *, granted_by: str
) -> BetaAccess:
    """Gives a user beta access for a number of days (replaces a running one).

    The launch backfill never touches an existing row, so it stays idempotent;
    an administrator promoting a single user is a deliberate override and
    restarts the term on the same row (the unique `user_id` keeps one row per
    user, like the courtesy replaces a running grant).

    Args:
        session: Database session.
        user_id: User who receives it.
        data: Number of days.
        granted_by: Administrator e-mail.

    Returns:
        The running grant.

    Raises:
        HTTPException: 404 when the user does not exist.
    """
    if session.get(User, user_id) is None:
        raise _not_found("Usuário")
    now = datetime.now(UTC)
    beta = session.scalars(
        select(BetaAccess).where(BetaAccess.user_id == user_id)
    ).first()
    if beta is None:
        beta = BetaAccess(user_id=user_id)
        session.add(beta)
    beta.granted_at = now
    beta.expires_at = now + timedelta(days=data.days)
    beta.source = BETA_SOURCE_ADMIN
    beta.granted_by = granted_by
    session.commit()
    session.refresh(beta)
    return beta


def revoke_beta(session: Session, user_id: UUID) -> None:
    """Ends a user's beta access now, keeping the row for the record.

    Args:
        session: Database session.
        user_id: User who loses it.

    Raises:
        HTTPException: 404 when the user has no beta row.
    """
    beta = session.scalars(
        select(BetaAccess).where(BetaAccess.user_id == user_id)
    ).first()
    if beta is None:
        raise _not_found("Beta")
    beta.expires_at = datetime.now(UTC)
    session.commit()


def set_user_role(
    session: Session, user_id: UUID, data: RoleUpdate, *, actor_id: UUID
) -> User:
    """Promotes a user to administrator or demotes them back to user.

    An administrator cannot demote their own account: a slip would lock the
    only way in, and promoting someone else back would already require an
    administrator.

    Args:
        session: Database session.
        user_id: User whose role changes.
        data: The new role (`admin` or `user`).
        actor_id: Administrator performing the change.

    Returns:
        The updated user.

    Raises:
        HTTPException: 404 when the user does not exist; 400 when the actor
            tries to demote their own account.
    """
    user = session.get(User, user_id)
    if user is None:
        raise _not_found("Usuário")
    if data.role != ROLE_ADMIN and user.id == actor_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode rebaixar a própria conta.",
        )
    user.role = data.role
    session.commit()
    session.refresh(user)
    return user
