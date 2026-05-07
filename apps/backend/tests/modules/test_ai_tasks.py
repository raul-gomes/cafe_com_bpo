"""
AI Task Features Tests — TDD Approach
Tests for AI-powered task analysis and suggestions.
"""

import pytest
from uuid import uuid4


class TestAITaskAPI:
    """Tests for AI task endpoints."""

    def _get_auth_header(self, client, email):
        payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
        client.post("/auth/register", json=payload)
        resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_analyze_task_returns_suggestions(self, client):
        """AI should analyze a task and return priority, process type, and deadline suggestions."""
        email = f"ai_task_user_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post("/tasks/ai/analyze", json={
            "title": "Fechamento fiscal mensal",
            "description": "Realizar o fechamento das obrigações fiscais do mês",
        }, headers=auth)

        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_priority" in data
        assert data["suggested_priority"] in ["low", "medium", "high"]
        assert "reasoning" in data
        assert len(data["reasoning"]) > 0

    def test_analyze_task_with_process_type(self, client):
        """AI should respect provided process type when analyzing."""
        email = f"ai_task_user2_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post("/tasks/ai/analyze", json={
            "title": "Folha de pagamento",
            "description": "Processar folha de pagamento dos funcionários",
            "process_type": "dp",
        }, headers=auth)

        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_priority" in data

    def test_get_task_suggestions_returns_list(self, client):
        """AI should return task suggestions based on user's history."""
        email = f"ai_task_user3_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.get("/tasks/ai/suggestions", headers=auth)

        assert resp.status_code == 200
        data = resp.json()
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)

    def test_analyze_task_without_description(self, client):
        """AI should handle tasks without description."""
        email = f"ai_task_user4_{uuid4()}@cafe.com"
        auth = self._get_auth_header(client, email)

        resp = client.post("/tasks/ai/analyze", json={
            "title": "Conciliação bancária",
        }, headers=auth)

        assert resp.status_code == 200
        data = resp.json()
        assert "suggested_priority" in data
