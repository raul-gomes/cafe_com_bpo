"""
Tests for the Feedback endpoint (POST /feedback/).

Verifies authentication, validation, and successful submission.
The actual email sending is mocked by the dev-mode fallback in tests.
"""
from unittest.mock import patch
from uuid import uuid4


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestFeedbackEndpoint:
    def test_send_feedback_success(self, client):
        """POST /feedback/ with valid data returns 200."""
        email = f"feedback_test_{uuid4()}@cafe.com"
        auth = get_auth_header(client, email)

        payload = {
            "title": "Erro ao gerar relatório",
            "description": "O relatório mensal não está exportando os dados corretamente.",
        }
        resp = client.post("/feedback/", json=payload, headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "message" in data
        assert "sucesso" in data["message"].lower()

    def test_send_feedback_requires_auth(self, client):
        """POST /feedback/ without auth returns 401."""
        payload = {
            "title": "Teste",
            "description": "Descrição com mais de 10 caracteres.",
        }
        resp = client.post("/feedback/", json=payload)
        assert resp.status_code == 401

    def test_send_feedback_title_too_short(self, client):
        """POST /feedback/ with short title returns 422."""
        email = f"feedback_test_{uuid4()}@cafe.com"
        auth = get_auth_header(client, email)

        payload = {
            "title": "ab",  # min_length=3
            "description": "Descrição com mais de 10 caracteres.",
        }
        resp = client.post("/feedback/", json=payload, headers=auth)
        assert resp.status_code == 422

    def test_send_feedback_description_too_short(self, client):
        """POST /feedback/ with short description returns 422."""
        email = f"feedback_test_{uuid4()}@cafe.com"
        auth = get_auth_header(client, email)

        payload = {
            "title": "Erro válido",
            "description": "curto",  # min_length=10
        }
        resp = client.post("/feedback/", json=payload, headers=auth)
        assert resp.status_code == 422

    @patch("src.modules.feedback.service.FeedbackService.send_feedback")
    def test_send_feedback_calls_service(self, mock_send, client):
        """Verify the service is called with correct args."""
        email = f"feedback_test_{uuid4()}@cafe.com"
        auth = get_auth_header(client, email)

        payload = {
            "title": "Relatório quebrado",
            "description": "O relatório fiscal não está gerando as abas corretamente.",
        }
        resp = client.post("/feedback/", json=payload, headers=auth)
        assert resp.status_code == 200

        mock_send.assert_called_once_with(
            title="Relatório quebrado",
            description="O relatório fiscal não está gerando as abas corretamente.",
            user_name="Test User",
            user_email=email,
        )
