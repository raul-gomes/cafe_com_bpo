"""
Provider adapter — isolamento do provedor de e-mail.

Interface interna (Protocol) seguindo o documento de implementação.
Implementações: ResendProvider (produção), MailpitProvider (dev local)
e NoopProvider (testes/CI).
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Protocol

import resend
from resend.exceptions import (
    ApplicationError,
    InvalidApiKeyError,
    MissingApiKeyError,
    MissingRequiredFieldsError,
    RateLimitError,
    ResendError,
    ValidationError,
)

from src.core.config import get_settings
from src.core.logger import log

from .retry_policy import PermanentError, RetryableError


class EmailProvider(Protocol):
    """Interface interna do provedor de e-mail."""

    def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        idempotency_key: str,
        attachments: list[dict] | None = None,
    ) -> str:
        """Envia um e-mail e retorna o provider_message_id."""
        ...


class ResendProvider:
    """Provedor padrão baseado no SDK resend (HTTP API)."""

    name = "resend"

    def __init__(self):
        settings = get_settings()
        api_key = settings.resend_api_key
        if not api_key:
            api_key = settings.smtp_password
        resend.api_key = api_key

    def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        idempotency_key: str,
        attachments: list[dict] | None = None,
    ) -> str:
        params: resend.Emails.SendParams = {
            "from": get_settings().resend_from_email,
            "to": [to],
            "subject": subject,
            "text": text,
            "html": html,
        }
        if attachments:
            params["attachments"] = attachments

        try:
            response = resend.Emails.send(params)
        except RateLimitError as e:
            raise RetryableError(f"Rate limit (429): {e}") from e
        except ApplicationError as e:
            raise RetryableError(f"Erro 5xx do provedor: {e}") from e
        except (
            ValidationError,
            MissingRequiredFieldsError,
            InvalidApiKeyError,
            MissingApiKeyError,
        ) as e:
            raise PermanentError(f"Erro permanente do Resend: {e}") from e
        except ResendError as e:
            raise RetryableError(
                f"Erro do Resend ({getattr(e, 'code', '?')}): {e}"
            ) from e
        except Exception as e:
            raise RetryableError(f"Erro de rede/desconhecido: {e}") from e

        message_id = None
        if isinstance(response, dict):
            message_id = response.get("id")

        return message_id or idempotency_key


class MailpitProvider:
    """
    Provedor de desenvolvimento local.

    Envia via SMTP para o container do Mailpit (mailpit:1025), que mantém
    uma caixa de entrada web (http://localhost:8025) para inspecionar os
    e-mails sem entregar de verdade. Mantém o fluxo completo
    (fila → worker → status 'sent').
    """

    name = "mailpit"

    def __init__(self):
        settings = get_settings()
        self.host = settings.mailpit_host
        self.port = settings.mailpit_port
        self.from_email = settings.resend_from_email or settings.smtp_from_email

    def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        idempotency_key: str,
        attachments: list[dict] | None = None,
    ) -> str:
        msg = MIMEMultipart("alternative")
        msg["From"] = self.from_email
        msg["To"] = to
        msg["Subject"] = subject

        if text:
            msg.attach(MIMEText(text, "plain", "utf-8"))
        if html:
            msg.attach(MIMEText(html, "html", "utf-8"))

        try:
            with smtplib.SMTP(self.host, self.port, timeout=10) as client:
                client.sendmail(self.from_email, [to], msg.as_string())
        except Exception as e:
            raise RetryableError(f"Erro ao conectar no Mailpit: {e}") from e

        log.info(
            f"📬 [MAILPIT] Para: {to} | Assunto: {subject} | "
            f"Idempotency: {idempotency_key}"
        )
        return f"mailpit-{idempotency_key}"


class NoopProvider:
    """Provedor nulo usado em testes/CI (MODE=test)."""

    name = "noop"

    def send(
        self,
        *,
        to: str,
        subject: str,
        html: str,
        text: str,
        idempotency_key: str,
        attachments: list[dict] | None = None,
    ) -> str:
        return f"noop-{idempotency_key}"


def get_provider() -> EmailProvider:
    """Retorna o provider conforme configuração EMAIL_PROVIDER."""
    settings = get_settings()
    provider_name = settings.email_provider

    if settings.mode == "test":
        return NoopProvider()

    if provider_name == "mailpit":
        return MailpitProvider()

    if provider_name == "resend":
        return ResendProvider()

    raise PermanentError(f"Provedor de e-mail desconhecido: {provider_name}")
