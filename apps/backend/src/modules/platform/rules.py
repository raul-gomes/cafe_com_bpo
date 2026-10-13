"""Pure rules of the platform content: YouTube links and the open café date."""

import calendar
import re
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

#: Cafés always start at 2 pm, Brasília time (same rule as the public page).
CAFE_TIMEZONE = ZoneInfo("America/Sao_Paulo")
CAFE_START_TIME = time(14, 0)
CAFE_DEFAULT_DURATION_MINUTES = 60

_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_PATTERNS = (
    # youtube.com/watch?v=ID (any extra query parameters)
    re.compile(
        r"^https?://(?:www\.|m\.)?youtube\.com/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})"
    ),
    # youtu.be/ID
    re.compile(r"^https?://youtu\.be/([A-Za-z0-9_-]{11})"),
    # youtube.com/embed/ID, /shorts/ID, /live/ID
    re.compile(
        r"^https?://(?:www\.|m\.)?(?:youtube|youtube-nocookie)\.com/"
        r"(?:embed|shorts|live)/([A-Za-z0-9_-]{11})"
    ),
)


def youtube_id_from(url: str) -> str | None:
    """Extracts the video id of a YouTube link.

    Args:
        url: Link pasted by the administrator, or a bare 11-character id.

    Returns:
        The video id, or `None` when the text is not a YouTube video link.
    """
    text = url.strip()
    if _YOUTUBE_ID.match(text):
        return text
    for pattern in _YOUTUBE_PATTERNS:
        match = pattern.match(text)
        if match:
            return match.group(1)
    return None


def _last_wednesday(year: int, month: int) -> date:
    """Last Wednesday of a month.

    Args:
        year: Full year.
        month: Month, 1 to 12.

    Returns:
        The date.
    """
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    return last_day - timedelta(days=(last_day.weekday() - calendar.WEDNESDAY) % 7)


def next_open_cafe(now: datetime) -> datetime:
    """Start of the next open café: the last Wednesday of the month, 2 pm.

    Mirrors `nextOpenCafe` of the frontend. The day itself still counts until
    the meeting is over.

    Args:
        now: Reference instant (aware).

    Returns:
        The start of the next open café, in UTC.
    """
    local_now = now.astimezone(CAFE_TIMEZONE)
    year, month = local_now.year, local_now.month
    for _ in range(3):
        day = _last_wednesday(year, month)
        starts = datetime.combine(day, CAFE_START_TIME, tzinfo=CAFE_TIMEZONE)
        if starts + timedelta(minutes=CAFE_DEFAULT_DURATION_MINUTES) > local_now:
            return starts.astimezone(UTC)
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    raise AssertionError("unreachable: some last Wednesday is always ahead")
