"""
Timeline/Scheduling Tests — TDD Approach
Tests for timeline view and conflict detection.
"""

from uuid import uuid4
from datetime import datetime, timedelta


class TestTimelineAPI:
    """Tests for Timeline and scheduling endpoints."""

    def _get_auth_header(self, client, email):
        payload = {
            "email": email,
            "password": "StrongPassword123!",
            "name": "Test User",
        }
        client.post("/auth/register", json=payload)
        resp = client.post(
            "/auth/login", data={"username": email, "password": "StrongPassword123!"}
        )
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_get_timeline_returns_tasks_grouped_by_date(self, client):
        """Timeline should return tasks grouped by deadline date."""
        email = f"timeline_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        today = datetime.now()
        tomorrow = today + timedelta(days=1)

        # Create a client first
        client_resp = client.post(
            "/clients/", json={"name": "Test Client", "color": "#3b82f6"}, headers=auth
        )
        client_id = client_resp.json()["id"]

        # Create tasks with different deadlines
        client.post(
            "/tasks/",
            json={
                "title": "Task 1",
                "client_id": client_id,
                "deadline": today.isoformat(),
            },
            headers=auth,
        )

        client.post(
            "/tasks/",
            json={
                "title": "Task 2",
                "client_id": client_id,
                "deadline": today.isoformat(),
            },
            headers=auth,
        )

        client.post(
            "/tasks/",
            json={
                "title": "Task 3",
                "client_id": client_id,
                "deadline": tomorrow.isoformat(),
            },
            headers=auth,
        )

        resp = client.get("/tasks/timeline/", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "timeline" in data
        assert isinstance(data["timeline"], list)
        # Should have at least 2 dates
        assert len(data["timeline"]) >= 2

    def test_get_conflicts_detects_overlapping_deadlines(self, client):
        """Should detect tasks with overlapping deadlines."""
        email = f"conflict_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        same_deadline = datetime.now() + timedelta(days=2)

        # Create a client first
        client_resp = client.post(
            "/clients/", json={"name": "Test Client", "color": "#3b82f6"}, headers=auth
        )
        client_id = client_resp.json()["id"]

        # Create tasks with same deadline
        client.post(
            "/tasks/",
            json={
                "title": "Conflicting Task 1",
                "client_id": client_id,
                "deadline": same_deadline.isoformat(),
                "time_estimate_minutes": 300,
            },
            headers=auth,
        )

        client.post(
            "/tasks/",
            json={
                "title": "Conflicting Task 2",
                "client_id": client_id,
                "deadline": same_deadline.isoformat(),
                "time_estimate_minutes": 300,
            },
            headers=auth,
        )

        resp = client.get("/tasks/conflicts/", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "conflicts" in data
        assert isinstance(data["conflicts"], list)
        assert len(data["conflicts"]) > 0

    def test_get_conflicts_empty_when_no_overlaps(self, client):
        """Should return empty conflicts when tasks are well-spaced."""
        email = f"no_conflict_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Create a client first
        client_resp = client.post(
            "/clients/", json={"name": "Test Client", "color": "#3b82f6"}, headers=auth
        )
        client_id = client_resp.json()["id"]

        # Create tasks with different deadlines (spaced out)
        for i in range(5):
            client.post(
                "/tasks/",
                json={
                    "title": f"Task {i}",
                    "client_id": client_id,
                    "deadline": (datetime.now() + timedelta(days=i * 3)).isoformat(),
                    "time_estimate_minutes": 120,
                },
                headers=auth,
            )

        resp = client.get("/tasks/conflicts/", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["conflicts"]) == 0

    def test_timeline_filters_by_date_range(self, client):
        """Timeline should support filtering by date range."""
        email = f"timeline_filter_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        today = datetime.now()
        next_week = today + timedelta(days=7)

        # Create a client first
        client_resp = client.post(
            "/clients/", json={"name": "Test Client", "color": "#3b82f6"}, headers=auth
        )
        client_id = client_resp.json()["id"]

        # Create task within range
        client.post(
            "/tasks/",
            json={
                "title": "In Range Task",
                "client_id": client_id,
                "deadline": (today + timedelta(days=1)).isoformat(),
            },
            headers=auth,
        )

        # Create task outside range
        client.post(
            "/tasks/",
            json={
                "title": "Out of Range Task",
                "client_id": client_id,
                "deadline": (today + timedelta(days=30)).isoformat(),
            },
            headers=auth,
        )

        resp = client.get(
            f"/tasks/timeline/?start_date={today.isoformat()}&end_date={next_week.isoformat()}",
            headers=auth,
        )
        assert resp.status_code == 200
        data = resp.json()
        # Only the task within range should appear
        total_tasks = sum(len(day["tasks"]) for day in data["timeline"])
        assert total_tasks == 1

    def test_task_has_time_estimate_field(self, client):
        """Task should support time_estimate_minutes field."""
        email = f"time_est_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        # Create a client first
        client_resp = client.post(
            "/clients/", json={"name": "Test Client", "color": "#3b82f6"}, headers=auth
        )
        client_id = client_resp.json()["id"]

        resp = client.post(
            "/tasks/",
            json={
                "title": "Task with time estimate",
                "client_id": client_id,
                "time_estimate_minutes": 180,
            },
            headers=auth,
        )

        assert resp.status_code == 201
        data = resp.json()
        assert data.get("time_estimate_minutes") == 180
