"""
Notification Module Tests — TDD Approach
Tests for in-app notification system with decoupled dispatcher architecture.
"""

import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta


class TestNotificationModel:
    """Tests for AppNotification SQLAlchemy model."""

    def test_notification_model_has_required_fields(self):
        """AppNotification model should have all expected fields."""
        from src.modules.notifications.models import AppNotification
        assert hasattr(AppNotification, 'id')
        assert hasattr(AppNotification, 'user_id')
        assert hasattr(AppNotification, 'title')
        assert hasattr(AppNotification, 'message')
        assert hasattr(AppNotification, 'type')
        assert hasattr(AppNotification, 'is_read')
        assert hasattr(AppNotification, 'related_entity_type')
        assert hasattr(AppNotification, 'related_entity_id')
        assert hasattr(AppNotification, 'created_at')
        assert hasattr(AppNotification, 'read_at')


class TestNotificationSchemas:
    """Tests for Notification Pydantic schemas."""

    def test_notification_create_schema(self):
        """NotificationCreate schema should validate required fields."""
        from src.modules.notifications.schemas import NotificationCreate
        schema = NotificationCreate(
            title="Test",
            message="Test message",
            type="task_deadline"
        )
        assert schema.title == "Test"
        assert schema.type == "task_deadline"

    def test_notification_response_schema(self):
        """NotificationResponse should include all fields."""
        from src.modules.notifications.schemas import NotificationResponse, NotificationCreate
        create = NotificationCreate(title="Test", message="Test message", type="system")
        assert create.title == "Test"
        assert create.message == "Test message"
        assert create.type == "system"


class TestNotificationAPI:
    """Tests for Notification API endpoints."""

    def _get_auth_header(self, client, email):
        payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
        client.post("/auth/register", json=payload)
        resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_create_notification(self, client):
        """Should create a notification for the authenticated user."""
        email = f"notif_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)
        user_resp = client.get("/auth/me", headers=auth)
        user_id = user_resp.json()["id"]

        resp = client.post("/notifications/", json={
            "title": "Nova tarefa atribuída",
            "message": "Você tem uma nova tarefa pendente",
            "type": "task_assigned"
        }, headers=auth)

        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Nova tarefa atribuída"
        assert data["is_read"] is False
        assert data["user_id"] == user_id

    def test_get_user_notifications(self, client):
        """Should return all notifications for the authenticated user."""
        email = f"notif_user2_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Create 3 notifications
        for i in range(3):
            client.post("/notifications/", json={
                "title": f"Notification {i}",
                "message": f"Message {i}",
                "type": "system"
            }, headers=auth)

        resp = client.get("/notifications/", headers=auth)
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    def test_get_unread_count(self, client):
        """Should return count of unread notifications."""
        email = f"notif_user3_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Create 3 notifications
        for i in range(3):
            client.post("/notifications/", json={
                "title": f"Notification {i}",
                "message": f"Message {i}",
                "type": "system"
            }, headers=auth)

        resp = client.get("/notifications/unread-count", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["count"] == 3

    def test_mark_notification_as_read(self, client):
        """Should mark a single notification as read."""
        email = f"notif_user4_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post("/notifications/", json={
            "title": "Test",
            "message": "Test message",
            "type": "system"
        }, headers=auth)
        notif_id = resp.json()["id"]

        resp = client.put(f"/notifications/{notif_id}/read", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    def test_mark_all_as_read(self, client):
        """Should mark all notifications as read."""
        email = f"notif_user5_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Create 3 notifications
        for i in range(3):
            client.post("/notifications/", json={
                "title": f"Notification {i}",
                "message": f"Message {i}",
                "type": "system"
            }, headers=auth)

        resp = client.post("/notifications/mark-all-read", headers=auth)
        assert resp.status_code == 200

        resp = client.get("/notifications/unread-count", headers=auth)
        assert resp.json()["count"] == 0

    def test_delete_notification(self, client):
        """Should delete a notification."""
        email = f"notif_user6_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post("/notifications/", json={
            "title": "To delete",
            "message": "This will be deleted",
            "type": "system"
        }, headers=auth)
        notif_id = resp.json()["id"]

        resp = client.delete(f"/notifications/{notif_id}", headers=auth)
        assert resp.status_code == 204

        resp = client.get("/notifications/", headers=auth)
        assert len(resp.json()) == 0

    def test_cannot_access_other_user_notifications(self, client):
        """Users should not see other users' notifications."""
        email1 = f"notif_user7a_{uuid4()}@cafe.com"
        email2 = f"notif_user7b_{uuid4()}@cafe.com"
        auth1 = self._get_auth_header(client, email1)
        auth2 = self._get_auth_header(client, email2)

        # User 1 creates notification
        client.post("/notifications/", json={
            "title": "Private",
            "message": "Secret message",
            "type": "system"
        }, headers=auth1)

        # User 2 should not see it
        resp = client.get("/notifications/", headers=auth2)
        assert len(resp.json()) == 0

    def test_notification_types_enum(self, client):
        """Should support standard notification types."""
        email = f"notif_user8_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        valid_types = ["task_assigned", "task_deadline", "task_overdue", "phase_change", "system", "proposal"]
        for notif_type in valid_types:
            resp = client.post("/notifications/", json={
                "title": f"Type: {notif_type}",
                "message": "Testing type",
                "type": notif_type
            }, headers=auth)
            assert resp.status_code == 201

    def test_filter_notifications_by_type(self, client):
        """Should be able to filter notifications by type."""
        email = f"notif_user9_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        client.post("/notifications/", json={
            "title": "Task notification",
            "message": "Task message",
            "type": "task_assigned"
        }, headers=auth)

        client.post("/notifications/", json={
            "title": "System notification",
            "message": "System message",
            "type": "system"
        }, headers=auth)

        resp = client.get("/notifications/?type=task_assigned", headers=auth)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["type"] == "task_assigned"

    def test_notifications_sorted_by_created_at_desc(self, client):
        """Notifications should be returned newest first."""
        email = f"notif_user10_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)
        import time

        # Create first notification
        resp1 = client.post("/notifications/", json={
            "title": "Notification 0",
            "message": "Message 0",
            "type": "system"
        }, headers=auth)
        first_id = resp1.json()["id"]

        time.sleep(0.05)

        # Create second notification
        resp2 = client.post("/notifications/", json={
            "title": "Notification 1",
            "message": "Message 1",
            "type": "system"
        }, headers=auth)
        second_id = resp2.json()["id"]

        resp = client.get("/notifications/", headers=auth)
        notifications = resp.json()
        assert len(notifications) == 2
        # Newest (second) should be first in the list
        assert notifications[0]["id"] == second_id
        assert notifications[-1]["id"] == first_id
