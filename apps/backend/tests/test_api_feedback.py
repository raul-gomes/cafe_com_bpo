"""
Tests for the Feedback endpoint (POST /feedback/).

Verifies authentication, validation, screenshot attachment and successful
submission. The endpoint receives multipart form data so the user can attach
a print of the error.
The actual email sending is mocked by the dev-mode fallback in tests.
"""

from unittest.mock import patch
from uuid import uuid4

from src.core.database import SessionLocal
from src.core.security import PasswordService
from src.modules.auth.repository import UserRepository


def get_auth_header(client, email):
    """Cria o usuário direto no banco (registro público foi removido)."""
    session = SessionLocal()
    try:
        UserRepository(session).create_user(
            email=email,
            password_hash=PasswordService.hash_password("StrongPassword123!"),
            name="Test User",
            terms_accepted=True,
        )
        session.commit()
    finally:
        session.close()

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
        resp = client.post("/feedback/", data=payload, headers=auth)
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
        resp = client.post("/feedback/", data=payload)
        assert resp.status_code == 401

    def test_send_feedback_title_too_short(self, client):
        """POST /feedback/ with short title returns 422."""
        email = f"feedback_test_{uuid4()}@cafe.com"
        auth = get_auth_header(client, email)

        payload = {
            "title": "ab",  # min_length=3
            "description": "Descrição com mais de 10 caracteres.",
        }
        resp = client.post("/feedback/", data=payload, headers=auth)
        assert resp.status_code == 422

    def test_send_feedback_description_too_short(self, client):
        """POST /feedback/ with short description returns 422."""
        email = f"feedback_test_{uuid4()}@cafe.com"
        auth = get_auth_header(client, email)

        payload = {
            "title": "Erro válido",
            "description": "curto",  # min_length=10
        }
        resp = client.post("/feedback/", data=payload, headers=auth)
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
        resp = client.post("/feedback/", data=payload, headers=auth)
        assert resp.status_code == 200

        mock_send.assert_called_once_with(
            title="Relatório quebrado",
            description="O relatório fiscal não está gerando as abas corretamente.",
            user_name="Test User",
            user_email=email,
            screenshot=None,
        )


class TestSupportEmailWiring:
    def _send(self, feedback_email, support_email):
        """Executa send_feedback com settings controlados do módulo service."""
        from types import SimpleNamespace

        from src.core.email import EmailService
        from src.modules import feedback

        fake_settings = SimpleNamespace(
            feedback_email=feedback_email, support_email=support_email
        )
        with (
            patch.object(feedback.service, "settings", fake_settings),
            patch.object(EmailService, "send_email") as mock_send,
        ):
            feedback.service.FeedbackService.send_feedback(
                title="Título",
                description="Descrição",
                user_name="U",
                user_email="u@x.com",
            )
            return mock_send.call_args.args[0]

    def test_send_feedback_targets_support_email_from_settings(self):
        """Sem FEEDBACK_EMAIL, usa SUPPORT_EMAIL das configurações."""
        recipient = self._send(
            feedback_email="", support_email="cafe@cafecombpo.com.br"
        )
        assert recipient == "cafe@cafecombpo.com.br"

    def test_send_feedback_prefers_feedback_email_when_set(self):
        """Quando FEEDBACK_EMAIL está definido, é o destinatário preferido."""
        recipient = self._send(
            feedback_email="cafecombpo@gmail.com",
            support_email="cafe@cafecombpo.com.br",
        )
        assert recipient == "cafecombpo@gmail.com"

    def test_send_feedback_falls_back_to_support_email_when_empty(self):
        """Sem FEEDBACK_EMAIL definido, usa SUPPORT_EMAIL (fallback)."""
        recipient = self._send(feedback_email="", support_email="suporte@cafe.com.br")
        assert recipient == "suporte@cafe.com.br"


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG_BYTES = b"\xff\xd8\xff\xe0" + b"\x00" * 64
VALID_FORM = {
    "title": "Tela travou",
    "description": "Ao salvar o contrato a tela ficou carregando para sempre.",
}


class TestFeedbackScreenshot:
    """Optional screenshot attached to "Reportar erro"."""

    @patch("src.modules.feedback.service.FeedbackService.send_feedback")
    def test_png_screenshot_is_forwarded_with_safe_name(self, mock_send, client):
        auth = get_auth_header(client, f"feedback_test_{uuid4()}@cafe.com")
        resp = client.post(
            "/feedback/",
            data=VALID_FORM,
            files={"screenshot": ("../../etc/passwd.png", PNG_BYTES, "image/png")},
            headers=auth,
        )
        assert resp.status_code == 200
        screenshot = mock_send.call_args.kwargs["screenshot"]
        filename, content = screenshot
        # The client filename is never used (path traversal): the server names it.
        assert filename == "print-do-erro.png"
        assert content == PNG_BYTES

    @patch("src.modules.feedback.service.FeedbackService.send_feedback")
    def test_jpeg_detected_by_content_not_by_declared_type(self, mock_send, client):
        auth = get_auth_header(client, f"feedback_test_{uuid4()}@cafe.com")
        resp = client.post(
            "/feedback/",
            data=VALID_FORM,
            files={"screenshot": ("foto.png", JPEG_BYTES, "image/png")},
            headers=auth,
        )
        assert resp.status_code == 200
        assert mock_send.call_args.kwargs["screenshot"][0] == "print-do-erro.jpg"

    @patch("src.modules.feedback.service.FeedbackService.send_feedback")
    def test_non_image_is_rejected(self, mock_send, client):
        auth = get_auth_header(client, f"feedback_test_{uuid4()}@cafe.com")
        resp = client.post(
            "/feedback/",
            data=VALID_FORM,
            files={
                "screenshot": ("print.png", b"<script>alert(1)</script>", "image/png")
            },
            headers=auth,
        )
        assert resp.status_code == 422
        mock_send.assert_not_called()

    @patch("src.modules.feedback.service.FeedbackService.send_feedback")
    def test_oversized_screenshot_is_rejected(self, mock_send, client):
        from src.modules.feedback.router import MAX_SCREENSHOT_BYTES

        auth = get_auth_header(client, f"feedback_test_{uuid4()}@cafe.com")
        big = PNG_BYTES + b"\x00" * MAX_SCREENSHOT_BYTES
        resp = client.post(
            "/feedback/",
            data=VALID_FORM,
            files={"screenshot": ("print.png", big, "image/png")},
            headers=auth,
        )
        assert resp.status_code == 413
        mock_send.assert_not_called()


class TestFeedbackEmailContent:
    def _capture(self, **kwargs):
        from src.core.email import EmailService
        from src.modules import feedback

        with patch.object(EmailService, "send_email") as mock_send:
            feedback.service.FeedbackService.send_feedback(
                title=kwargs.get("title", "Título"),
                description=kwargs.get("description", "Descrição longa"),
                user_name=kwargs.get("user_name", "U"),
                user_email="u@x.com",
                screenshot=kwargs.get("screenshot"),
            )
            return mock_send.call_args

    def test_user_text_is_html_escaped(self):
        """User text must never become HTML in the support e-mail."""
        call = self._capture(
            title='<a href="https://phish.example">Clique</a>',
            description="<img src=x onerror=alert(1)>",
            user_name="<b>Fulano</b>",
        )
        html = call.args[3]
        assert "<a href=" not in html
        assert "<img" not in html
        assert "<b>Fulano</b>" not in html
        assert "&lt;a href=" in html
        assert "&lt;img src=x onerror=alert(1)&gt;" in html

    def test_screenshot_goes_as_base64_attachment(self):
        import base64

        call = self._capture(screenshot=("print-do-erro.png", PNG_BYTES))
        attachments = call.kwargs["attachments"]
        assert attachments == [
            {
                "filename": "print-do-erro.png",
                "content": base64.b64encode(PNG_BYTES).decode(),
            }
        ]

    def test_no_screenshot_means_no_attachment(self):
        call = self._capture()
        assert call.kwargs["attachments"] is None


def test_send_email_queues_attachments_in_payload():
    """EmailService.send_email forwards attachments to the payload the worker reads."""
    from src.core.email import EmailService

    with patch.object(EmailService, "_enqueue") as mock_enqueue:
        EmailService.send_email(
            "suporte@cafe.com",
            "Assunto",
            "texto",
            "<p>html</p>",
            attachments=[{"filename": "a.png", "content": "QUJD"}],
        )
    payload = mock_enqueue.call_args.kwargs["payload"]
    assert payload["attachments"] == [{"filename": "a.png", "content": "QUJD"}]
