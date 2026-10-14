from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from .rules import youtube_id_from

LessonSection = Literal["primeiros-passos", "bpo-primeiros-passos", "mentorias"]
Audience = Literal["all", "paying", "free"]


def _strip(value: object) -> object:
    """Trims surrounding spaces of a text field; empty text becomes `None`.

    Args:
        value: Raw field value.

    Returns:
        The trimmed string (or `None` when blank), or the value untouched.
    """
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _check_http_url(value: str | None) -> str | None:
    """Accepts only http(s) links, so a stored link is always safe to open.

    Args:
        value: Link typed by the administrator.

    Returns:
        The link.

    Raises:
        ValueError: When the link is not http(s).
    """
    if value is not None and not value.startswith(("https://", "http://")):
        raise ValueError("Use um link começando com https://")
    return value


#: Text field trimmed before validation (blank becomes None).
Trimmed = Annotated[str, BeforeValidator(_strip)]
OptionalTrimmed = Annotated[str | None, BeforeValidator(_strip)]
#: Optional http(s) link.
HttpLink = Annotated[
    str | None, BeforeValidator(_strip), AfterValidator(_check_http_url)
]


# ── Lessons ────────────────────────────────────────────────────────────────


class LessonWrite(BaseModel):
    """Lesson fields an administrator creates or edits."""

    section: LessonSection
    title: Trimmed = Field(..., min_length=2, max_length=150)
    summary: OptionalTrimmed = Field(None, max_length=1000)
    video_url: OptionalTrimmed = Field(None, max_length=500)
    position: int = Field(0, ge=0, le=999)
    is_published: bool = False

    @field_validator("video_url", mode="after")
    @classmethod
    def _youtube_only(cls, value: str | None) -> str | None:
        """Requires a YouTube video link, the only player the page embeds.

        Args:
            value: Link typed by the administrator.

        Returns:
            The link.

        Raises:
            ValueError: When it is not a YouTube video link.
        """
        if value is not None and youtube_id_from(value) is None:
            raise ValueError("Cole o link de um vídeo do YouTube.")
        return value


class LessonResponse(BaseModel):
    """A lesson as the Aulas pages render it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    section: str
    title: str
    summary: str | None
    youtube_id: str | None
    position: int


class AdminLessonResponse(LessonResponse):
    """A lesson on the admin page, which also edits the link and the status."""

    video_url: str | None
    is_published: bool


# ── Announcements ──────────────────────────────────────────────────────────


class AnnouncementCreate(BaseModel):
    """A message an administrator sends."""

    title: Trimmed = Field(..., min_length=2, max_length=120)
    message: Trimmed = Field(..., min_length=2, max_length=1000)
    audience: Audience = "all"
    show_on_home: bool = True
    expires_at: datetime | None = None


class AnnouncementResponse(BaseModel):
    """A message as the home post-it renders it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    message: str
    created_at: datetime


class AdminAnnouncementResponse(AnnouncementResponse):
    """A message on the admin page, with who it went to."""

    audience: str
    show_on_home: bool
    expires_at: datetime | None
    recipients_count: int


# ── Site settings ──────────────────────────────────────────────────────────


class LoginNotice(BaseModel):
    """The message on the brand side of the login window."""

    title: Trimmed = Field(..., min_length=2, max_length=80)
    message: Trimmed = Field(..., min_length=2, max_length=280)
    link_label: OptionalTrimmed = Field(None, max_length=40)
    link_url: HttpLink = Field(None, max_length=500)

    @model_validator(mode="after")
    def _label_needs_link(self) -> "LoginNotice":
        """A link label without a link (or the reverse) would render broken.

        Returns:
            The notice.

        Raises:
            ValueError: When only one of the two is filled.
        """
        if bool(self.link_label) != bool(self.link_url):
            raise ValueError(
                "Preencha o texto e o endereço do link, ou nenhum dos dois."
            )
        return self


class CafeMeeting(BaseModel):
    """The next open café, as the administrator sets it."""

    title: Trimmed = Field("Café aberto do Café com BPO", min_length=2, max_length=120)
    meet_url: HttpLink = Field(None, max_length=500)
    # Empty = the default rule (last Wednesday of the month, 2 pm).
    starts_at: datetime | None = None
    duration_minutes: int = Field(60, ge=15, le=240)


class PublicCafeMeeting(BaseModel):
    """The next open café on the public page. Never carries the link."""

    title: str
    starts_at: datetime
    duration_minutes: int


class PublicSiteResponse(BaseModel):
    """Editable pieces of the public site, read before login."""

    login_notice: LoginNotice
    cafe_meeting: PublicCafeMeeting


class AdminSiteResponse(BaseModel):
    """Everything the admin page edits, with the stored meeting link."""

    login_notice: LoginNotice
    cafe_meeting: CafeMeeting
    next_meeting_starts_at: datetime


# ── Café attendance ────────────────────────────────────────────────────────


class CafeRsvpCreate(BaseModel):
    """Attendance confirmation; the person picks which contact to leave."""

    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=30)
    # Honeypot: invisible to people, filled by bots.
    website: str | None = Field(None, max_length=200)

    @field_validator("name", "phone", mode="before")
    @classmethod
    def _strip_fields(cls, value: object) -> object:
        """Trims free-text fields.

        Args:
            value: Raw field value.

        Returns:
            The trimmed value.
        """
        return _strip(value)

    @field_validator("email", mode="before")
    @classmethod
    def _blank_email(cls, value: object) -> object:
        """An empty e-mail box means "no e-mail", not an invalid e-mail.

        Args:
            value: Raw field value.

        Returns:
            The lowercased e-mail, or `None`.
        """
        value = _strip(value)
        return value.lower() if isinstance(value, str) else value

    @field_validator("phone", mode="after")
    @classmethod
    def _phone_digits(cls, value: str | None) -> str | None:
        """Keeps only digits and checks the length of a Brazilian number.

        Args:
            value: Phone as typed.

        Returns:
            The digits, or `None`.

        Raises:
            ValueError: When the number is too short or too long.
        """
        if value is None:
            return None
        digits = "".join(ch for ch in value if ch.isdigit())
        if not 10 <= len(digits) <= 13:
            raise ValueError("Informe o telefone com DDD.")
        return digits

    @model_validator(mode="after")
    def _one_contact(self) -> "CafeRsvpCreate":
        """At least one way to reach the person.

        Returns:
            The confirmation.

        Raises:
            ValueError: When neither e-mail nor phone was given.
        """
        if not self.email and not self.phone:
            raise ValueError("Deixe um e-mail ou um telefone.")
        return self


class CafeRsvpAccepted(BaseModel):
    """What the person needs after confirming: when, and the link if it exists."""

    title: str
    starts_at: datetime
    duration_minutes: int
    meet_url: str | None


class CafeRsvpResponse(BaseModel):
    """A confirmation on the admin page."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str | None
    phone: str | None
    meeting_starts_at: datetime
    created_at: datetime


# ── Users and courtesy (admin) ─────────────────────────────────────────────


class CourtesyCreate(BaseModel):
    """A free-access period the administrator grants to one user."""

    days: int = Field(..., ge=1, le=730)
    reason: OptionalTrimmed = Field(None, max_length=300)


class CourtesyResponse(BaseModel):
    """A running courtesy, as the admin users list shows it."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    expires_at: datetime
    reason: str | None


class BetaGrantCreate(BaseModel):
    """A beta-access period the administrator grants to one user."""

    days: int = Field(..., ge=1, le=730)


class BetaResponse(BaseModel):
    """A running beta access, as the admin users page shows it."""

    model_config = ConfigDict(from_attributes=True)

    expires_at: datetime


class RoleUpdate(BaseModel):
    """The role an administrator assigns to a user, and only these two."""

    role: Literal["admin", "user"]


class RoleResponse(BaseModel):
    """The id and new role of a user, after a promote or demote."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    role: str


class AdminUserResponse(BaseModel):
    """One row of the admin users list."""

    id: UUID
    name: str | None
    email: str
    role: str
    created_at: datetime | None
    access_state: str
    access_expires_at: datetime | None
    courtesy: CourtesyResponse | None
