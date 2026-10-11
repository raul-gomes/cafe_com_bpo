from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UrgentTaskResponse(BaseModel):
    """One task due in the next three days, as the dashboard carousel renders it.

    The carousel highlights the row by its deadline only — `days_remaining`
    feeds the "vence hoje/amanhã/atrasada" label and `is_overdue` the color and
    the bold weight — and completing a task sends the phase resolved by the page
    from its own phase list. So `priority` and `phase_id` are out: no dashboard
    code reads them.
    """

    id: UUID
    title: str
    client_name: str
    deadline: datetime | None = None
    days_remaining: int | None = None
    is_overdue: bool = False

    model_config = ConfigDict(from_attributes=True)


class ActivityResponse(BaseModel):
    """One entry of the recent activity feed.

    `post_id` is what the click handler navigates with, and it is only set for a
    discussion post. `comment_id` is out: it was hardcoded to `None` and nothing
    ever read it.
    """

    id: UUID
    type: str
    created_at: datetime
    is_read: bool
    post_id: UUID | None = None
    triggered_by_name: str | None = None
    message_snippet: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PendingInvitation(BaseModel):
    """One pending team invitation, as `PendingInvitationCard` renders it.

    The card shows who invited, for which client and how long ago it arrived, and
    accepts or declines it by `invitation_id`. `client_id` is out (nothing links
    through it) and `expires_at` is out as well — the query already filters the
    expired ones out, so it would always be a future date nobody reads.
    """

    invitation_id: UUID
    client_name: str | None = None
    inviter_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardStats(BaseModel):
    """The two counters of the dashboard sidebar.

    `unread_notifications_count` is a real `COUNT` over the caller's unread
    notifications, not the length of the activity feed: the feed is capped at 20
    rows for the page, and a member with more than that must still see the true
    number.
    """

    pending_tasks_count: int
    unread_notifications_count: int


class DashboardSummary(BaseModel):
    """What the panel landing page renders on its first paint."""

    user_name: str
    urgent_tasks: list[UrgentTaskResponse]
    activities: list[ActivityResponse]
    pending_invitations: list[PendingInvitation] = Field(default_factory=list)
    stats: DashboardStats
