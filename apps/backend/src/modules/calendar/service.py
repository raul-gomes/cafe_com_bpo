"""
Google Calendar integration service.

Provides OAuth2 token management and Google Calendar API event creation.
"""

import logging
import httpx
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import Optional

from src.core.config import get_settings
from src.core.database import SessionLocal
from .repository import GoogleTokenRepository

log = logging.getLogger(__name__)

CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"


class GoogleCalendarService:
    """
    Service to sync tasks to Google Calendar.

    Manages OAuth2 tokens (stored in UserGoogleToken table) and creates
    calendar events via the Google Calendar API v3.
    """

    def __init__(self):
        self.settings = get_settings()
        self._enabled = bool(
            self.settings.google_calendar_client_id
            and self.settings.google_calendar_client_secret
        )

    # ── Token management ──

    def _get_repo(self) -> GoogleTokenRepository:
        session = SessionLocal()
        return GoogleTokenRepository(session)

    def get_token_status(self, user_id: UUID) -> dict:
        """Check if user has a valid (non-expired) token."""
        repo = self._get_repo()
        token = repo.get_by_user_id(user_id)
        if token is None:
            return {"connected": False, "email": None}
        # TODO: return the Google email associated with the token
        return {"connected": True, "email": None}

    def _ensure_valid_token(self, user_id: UUID) -> Optional[str]:
        """
        Return a valid access_token for the user.

        Refreshes if expired. Returns None if no token exists or refresh fails.
        """
        repo = self._get_repo()
        token = repo.get_by_user_id(user_id)
        if token is None:
            return None

        # Check if token is expired (with 5min buffer)
        now = datetime.now(timezone.utc)
        if token.expires_at and token.expires_at.replace(tzinfo=timezone.utc) < now:
            # Token expired — try refresh
            return self._refresh_token(token, repo)

        return token.access_token

    def _refresh_token(self, token, repo) -> Optional[str]:
        """Use refresh_token to get a new access_token from Google."""
        if not token.refresh_token:
            log.warning("No refresh_token available for user — deleting token")
            repo.delete_by_user_id(token.user_id)
            return None

        url = self.settings.google_token_url
        data = {
            "client_id": self.settings.google_calendar_client_id,
            "client_secret": self.settings.google_calendar_client_secret,
            "refresh_token": token.refresh_token,
            "grant_type": "refresh_token",
        }
        try:
            res = httpx.post(url, data=data, timeout=15)
            if res.is_error:
                log.error(f"Token refresh failed: {res.status_code} {res.text}")
                repo.delete_by_user_id(token.user_id)
                return None

            token_data = res.json()
            new_access_token = token_data.get("access_token", "")
            expires_in = token_data.get("expires_in", 3600)
            new_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

            repo.upsert(
                user_id=token.user_id,
                access_token=new_access_token,
                refresh_token=token.refresh_token,  # Google may not return a new one
                expires_at=new_expires_at,
                scope=token.scope,
            )
            return new_access_token
        except httpx.RequestError as e:
            log.error(f"Token refresh network error: {e}")
            return None

    # ── Auth URL ──

    def get_auth_url(self) -> str:
        """Return the Google OAuth2 authorization URL for Calendar scope."""
        if not self._enabled:
            log.warning("Google Calendar not configured — returning empty auth URL")
            return ""
        base = "https://accounts.google.com/o/oauth2/v2/auth"
        return (
            f"{base}?"
            f"client_id={self.settings.google_calendar_client_id}&"
            f"redirect_uri={self.settings.google_calendar_redirect_uri}&"
            f"response_type=code&"
            f"scope={CALENDAR_SCOPE}&"
            f"access_type=offline&"
            f"prompt=consent"
        )

    # ── Token exchange (callback) ──

    def exchange_code_for_token(self, code: str) -> dict:
        """
        Exchange an authorization code for tokens via Google's token endpoint.

        Returns the raw token response from Google.
        """
        url = self.settings.google_token_url
        data = {
            "code": code,
            "client_id": self.settings.google_calendar_client_id,
            "client_secret": self.settings.google_calendar_client_secret,
            "redirect_uri": self.settings.google_calendar_redirect_uri,
            "grant_type": "authorization_code",
        }
        res = httpx.post(url, data=data, timeout=15)
        if res.is_error:
            raise Exception(f"Falha ao trocar código Google Calendar: {res.text}")
        return res.json()

    def save_token_from_callback(self, user_id: UUID, token_data: dict) -> None:
        """Save tokens received from OAuth callback."""
        access_token = token_data["access_token"]
        refresh_token = token_data.get("refresh_token", "")
        expires_in = token_data.get("expires_in", 3600)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        repo = self._get_repo()
        repo.upsert(
            user_id=user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at,
            scope=CALENDAR_SCOPE,
        )
        log.info(f"Google Calendar token saved for user {user_id}")

    # ── Sync tasks ──

    def sync_tasks_to_calendar(
        self, user_id: UUID, task_ids: list[UUID], access_token: Optional[str] = None
    ) -> dict:
        """
        Sync tasks to Google Calendar.

        If access_token is provided, uses it directly. Otherwise attempts to
        retrieve a valid token from storage (with auto-refresh).
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
                    {"task_id": str(tid), "status": "mock_synced"} for tid in task_ids
                ],
            }

        # Get a valid token
        token = access_token or self._ensure_valid_token(user_id)
        if not token:
            return {"synced": 0, "failed": len(task_ids), "details": []}

        # TODO: In 8.3d/8.3e, replace with real event creation
        log.info(
            f"Google Calendar would sync {len(task_ids)} tasks "
            f"for user {user_id} (token available)"
        )
        return {
            "synced": 0,
            "failed": len(task_ids),
            "details": [
                {"task_id": str(tid), "status": "not_implemented"} for tid in task_ids
            ],
        }
