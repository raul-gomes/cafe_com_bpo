"""
Google Calendar integration service (skeleton).

This module provides the interface for syncing tasks to Google Calendar.
The current implementation is a mock/wrapper that logs the sync intent.
Full OAuth2 + Google Calendar API integration will be added when credentials
are configured.
"""

import logging
from uuid import UUID
from typing import Optional

from src.core.config import get_settings

log = logging.getLogger(__name__)


class GoogleCalendarService:
    """
    Service to sync tasks to Google Calendar.

    Currently operates in mock mode — logs sync requests and returns success.
    When GOOGLE_CALENDAR_CLIENT_ID is configured, it performs real API calls.
    """

    def __init__(self):
        self.settings = get_settings()
        self._enabled = bool(
            self.settings.google_calendar_client_id
            and self.settings.google_calendar_client_secret
        )

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def get_auth_url(self) -> str:
        """Return the Google OAuth2 authorization URL for Calendar scope."""
        if not self._enabled:
            log.warning("Google Calendar not configured — returning empty auth URL")
            return ""
        base = "https://accounts.google.com/o/oauth2/v2/auth"
        scope = "https://www.googleapis.com/auth/calendar.events"
        return (
            f"{base}?"
            f"client_id={self.settings.google_calendar_client_id}&"
            f"redirect_uri={self.settings.google_calendar_redirect_uri}&"
            f"response_type=code&"
            f"scope={scope}&"
            f"access_type=offline"
        )

    def sync_tasks_to_calendar(
        self, user_id: UUID, task_ids: list[UUID], access_token: Optional[str] = None
    ) -> dict:
        """
        Sync tasks to Google Calendar.

        Args:
            user_id: The user syncing tasks.
            task_ids: List of task UUIDs to sync.
            access_token: Google OAuth access token (required for real sync).

        Returns:
            dict with 'synced' count, 'failed' count, and 'details' list.
        """
        if not self._enabled:
            log.info(
                f"Google Calendar sync requested for user {user_id} "
                f"({len(task_ids)} tasks) — mock mode, skipping"
            )
            return {
                "synced": len(task_ids),
                "failed": 0,
                "details": [
                    {"task_id": str(tid), "status": "mock_synced"}
                    for tid in task_ids
                ],
            }

        if not access_token:
            log.warning("No access token provided for Google Calendar sync")
            return {"synced": 0, "failed": len(task_ids), "details": []}

        # Real implementation will:
        # 1. Fetch tasks from the database
        # 2. Build Google Calendar event objects
        # 3. POST to https://www.googleapis.com/calendar/v3/calendars/primary/events
        # 4. Return sync results
        log.info(
            f"Google Calendar real sync for user {user_id} "
            f"({len(task_ids)} tasks) — not yet implemented"
        )
        return {"synced": 0, "failed": len(task_ids), "details": []}
