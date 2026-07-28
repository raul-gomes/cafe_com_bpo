"""
Google Calendar integration service.

Provides OAuth2 token management and Google Calendar API event creation
using the official google-api-python-client library.
"""

import logging
from uuid import UUID
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import httpx

from src.core.config import get_settings
from src.core.database import SessionLocal
from .repository import GoogleTokenRepository

log = logging.getLogger(__name__)

CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"


class GoogleCalendarService:
    """
    Service to sync tasks to Google Calendar.

    Uses the official Google API client library for OAuth2 token management
    and Calendar API v3 event creation.
    """

    def __init__(self):
        self.settings = get_settings()
        self._enabled = bool(
            self.settings.google_calendar_client_id
            and self.settings.google_calendar_client_secret
        )

    # ── Repo ──

    def _get_repo(self) -> GoogleTokenRepository:
        session = SessionLocal()
        return GoogleTokenRepository(session)

    # ── Credentials ──

    def _build_credentials(self, token) -> Credentials:
        """
        Build a google.oauth2.credentials.Credentials from a stored token row.

        The Credentials object handles token refresh automatically when
        creds.refresh(Request()) is called.
        """
        return Credentials(
            token=token.access_token,
            refresh_token=token.refresh_token or "",
            token_uri=self.settings.google_token_url,
            client_id=self.settings.google_calendar_client_id,
            client_secret=self.settings.google_calendar_client_secret,
            scopes=[token.scope] if token.scope else [CALENDAR_SCOPE],
            expiry=token.expires_at.replace(tzinfo=timezone.utc)
            if token.expires_at
            else None,
        )

    def _ensure_valid_credentials(self, user_id: UUID) -> Optional[Credentials]:
        """
        Return valid Credentials for the user, refreshing if necessary.

        If the token is expired it tries to refresh it using the stored
        refresh_token. If refresh fails or no refresh_token exists, the
        token record is deleted so the user must re-authorize.
        """
        repo = self._get_repo()
        token = repo.get_by_user_id(user_id)
        if token is None:
            return None

        creds = self._build_credentials(token)

        if not creds.valid:
            if creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    repo.upsert(
                        user_id=user_id,
                        access_token=creds.token or "",
                        refresh_token=creds.refresh_token or token.refresh_token,
                        expires_at=creds.expiry
                        or (datetime.now(timezone.utc) + timedelta(hours=1)),
                        scope=CALENDAR_SCOPE,
                    )
                    log.info(f"Token refreshed successfully for user {user_id}")
                except Exception as e:
                    log.error(f"Token refresh failed for user {user_id}: {e}")
                    repo.delete_by_user_id(user_id)
                    return None
            else:
                log.warning(
                    f"Token expired with no refresh token for user {user_id} — "
                    f"deleting token record"
                )
                repo.delete_by_user_id(user_id)
                return None

        return creds

    # ── Token status ──

    def get_token_status(self, user_id: UUID) -> dict:
        """Check if user has a valid token and return the associated Google email."""
        repo = self._get_repo()
        token = repo.get_by_user_id(user_id)
        if token is None:
            return {"connected": False, "email": None}

        creds = self._ensure_valid_credentials(user_id)
        if creds is None:
            return {"connected": False, "email": None}

        email = self._fetch_email(creds)
        return {"connected": True, "email": email}

    def _fetch_email(self, creds: Credentials) -> Optional[str]:
        """Fetch the user's Google email using the OAuth2 userinfo endpoint."""
        try:
            oauth2_service = build(
                "oauth2", "v2", credentials=creds, cache_discovery=False
            )
            user_info = oauth2_service.userinfo().get().execute()
            return user_info.get("email")
        except Exception as e:
            log.debug(f"Could not fetch Google email from token: {e}")
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

        Returns the raw token response from Google containing access_token,
        refresh_token, expires_in, and scope.
        """
        data = {
            "code": code,
            "client_id": self.settings.google_calendar_client_id,
            "client_secret": self.settings.google_calendar_client_secret,
            "redirect_uri": self.settings.google_calendar_redirect_uri,
            "grant_type": "authorization_code",
        }
        res = httpx.post(self.settings.google_token_url, data=data, timeout=15)
        if res.is_error:
            raise Exception(f"Falha ao trocar código Google Calendar: {res.text}")
        return res.json()

    def save_token_from_callback(self, user_id: UUID, token_data: dict) -> None:
        """Save tokens received from OAuth callback into the database."""
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

    def sync_tasks_to_calendar(self, user_id: UUID, task_ids: list[UUID]) -> dict:
        """
        Create Google Calendar events for the given tasks.

        Returns a summary dict with ``synced``, ``failed`` counts and a
        ``details`` list with per-task status.
        """
        # ── Mock mode when not configured ──
        if not self._enabled or not task_ids:
            log.info(
                f"Calendar sync for user {user_id} ({len(task_ids)} tasks) "
                f"— {'configured' if self._enabled else 'not configured, mock mode'}"
            )
            return {
                "synced": len(task_ids),
                "failed": 0,
                "details": [
                    {"task_id": str(tid), "status": "mock_synced"} for tid in task_ids
                ],
            }

        # ── Get valid credentials ──
        creds = self._ensure_valid_credentials(user_id)
        if creds is None:
            log.warning(f"No valid credentials for user {user_id} — cannot sync")
            return {
                "synced": 0,
                "failed": len(task_ids),
                "details": [
                    {"task_id": str(tid), "status": "failed", "error": "No valid token"}
                    for tid in task_ids
                ],
            }

        # ── Fetch tasks from database ──
        from src.core.database import SessionLocal as TaskSession
        from src.modules.task_manager.models import Task

        db = TaskSession()
        try:
            tasks = (
                db.query(Task)
                .filter(
                    Task.id.in_(task_ids),
                    Task.user_id == user_id,
                    Task.is_active,
                )
                .all()
            )
        finally:
            db.close()

        if not tasks:
            return {"synced": 0, "failed": len(task_ids), "details": []}

        # ── Build Calendar API service ──
        try:
            service = build("calendar", "v3", credentials=creds, cache_discovery=False)
        except Exception as e:
            log.error(f"Failed to build Calendar API service: {e}")
            return {
                "synced": 0,
                "failed": len(task_ids),
                "details": [
                    {"task_id": str(tid), "status": "failed", "error": str(e)}
                    for tid in task_ids
                ],
            }

        # ── Create events ──
        synced = 0
        failed = 0
        details: list[dict] = []

        for task in tasks:
            try:
                event = self._build_event(task)
                created = (
                    service.events().insert(calendarId="primary", body=event).execute()
                )
                synced += 1
                details.append(
                    {
                        "task_id": str(task.id),
                        "status": "synced",
                        "event_id": created.get("id"),
                        "link": created.get("htmlLink"),
                    }
                )
                log.info(
                    f"Event created for task {task.id}: "
                    f"{created.get('htmlLink', 'no link')}"
                )
            except HttpError as e:
                failed += 1
                reason = e.reason or str(e)
                details.append(
                    {
                        "task_id": str(task.id),
                        "status": "failed",
                        "error": reason,
                    }
                )
                log.error(f"Google API error for task {task.id}: {reason}")
            except Exception as e:
                failed += 1
                details.append(
                    {
                        "task_id": str(task.id),
                        "status": "failed",
                        "error": str(e),
                    }
                )
                log.error(f"Unexpected error for task {task.id}: {e}")

        log.info(
            f"Calendar sync complete for user {user_id}: "
            f"{synced} synced, {failed} failed"
        )
        return {"synced": synced, "failed": failed, "details": details}

    # ── Event builder ──

    @staticmethod
    def _build_event(task) -> dict:
        """
        Build a Google Calendar event dict from a Task model instance.

        The event is scheduled at the task's deadline (1h before → deadline).
        If the task has no deadline it falls back to a 1h block starting now.
        High-priority tasks get a red color, medium yellow, low blue.
        """
        now = datetime.now(timezone.utc)

        if task.deadline:
            deadline = task.deadline.replace(tzinfo=timezone.utc)
            start_time = deadline - timedelta(hours=1)
            end_time = deadline
        else:
            start_time = now
            end_time = now + timedelta(hours=1)

        # Build description
        desc_lines: list[str] = []
        if task.description:
            desc_lines.append(task.description)
        if task.client_id:
            desc_lines.append(f"Cliente: {task.client_id}")
        if task.time_estimate_minutes:
            desc_lines.append(f"Tempo estimado: {task.time_estimate_minutes}min")
        description = "\n\n".join(desc_lines)

        event: dict = {
            "summary": task.title,
            "description": description,
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "America/Sao_Paulo",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "America/Sao_Paulo",
            },
        }

        # Color by priority
        color_map = {"high": "11", "medium": "5", "low": "9"}
        if task.priority in color_map:
            event["colorId"] = color_map[task.priority]

        return event
