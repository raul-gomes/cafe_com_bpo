"""
EmailService — fachada de enfileiramento de e-mails transacionais.

Não envia mais inline. Cria um registro na fila (email_deliveries) com
status 'pending' e retorna imediatamente; o worker faz o envio depois.
"""

import uuid as uuid_lib

from src.core.config import get_settings
from src.core.database import SessionLocal
from src.core.logger import log
from src.modules.emails.repository import EmailDeliveryRepository

settings = get_settings()


def _get_api_key() -> str:
    """Retorna a API key do Resend com fallback para o SMTP_PASSWORD."""
    return settings.resend_api_key or settings.smtp_password


class EmailService:
    @staticmethod
    def build_idempotency_key(kind: str, recipient: str, *parts: str) -> str:
        """Gera uma chave de idempotência única por envio."""
        token = uuid_lib.uuid4().hex
        return f"{kind}:{recipient}:{token}:{':'.join(parts)}"

    @staticmethod
    def _enqueue(
        *,
        kind: str,
        recipient: str,
        template: str,
        payload: dict,
        idempotency_key: str,
    ):
        """Cria a mensagem pendente na fila e responde imediatamente."""
        session = SessionLocal()
        try:
            repo = EmailDeliveryRepository(session)
            existing = repo.get_by_idempotency_key(idempotency_key)
            if existing:
                log.info(
                    f"ℹ️ E-mail duplicado ignorado (idempotência): {idempotency_key}"
                )
                return existing

            delivery = repo.create(
                kind=kind,
                recipient=recipient,
                template=template,
                payload=payload,
                idempotency_key=idempotency_key,
            )
            session.commit()
            log.info(f"📧 Enfileirado ({kind}) para {recipient}")
            return delivery
        finally:
            session.close()

    @staticmethod
    def send_email(
        to_email: str,
        subject: str,
        text: str = "",
        html: str = "",
    ) -> None:
        """Enfileira um e-mail com conteúdo livre (HTML/text prontos)."""
        key = EmailService.build_idempotency_key("notification", to_email)
        EmailService._enqueue(
            kind="notification",
            recipient=to_email,
            template="custom",
            payload={"subject": subject, "html": html, "text": text},
            idempotency_key=key,
        )

    @staticmethod
    def enqueue_notification(
        to_email: str,
        message: str,
        action_url: str = "",
    ) -> None:
        """Enfileira uma notificação usando o template 'notification'."""
        key = EmailService.build_idempotency_key("notification", to_email)
        EmailService._enqueue(
            kind="notification",
            recipient=to_email,
            template="notification",
            payload={"message": message, "action_url": action_url},
            idempotency_key=key,
        )

    @staticmethod
    def send_reset_password_email(to_email: str, reset_token: str) -> None:
        reset_url = f"{settings.frontend_url}/redefinir-senha?token={reset_token}"

        key = EmailService.build_idempotency_key(
            "password_reset", to_email, reset_token
        )
        EmailService._enqueue(
            kind="password_reset",
            recipient=to_email,
            template="password_reset",
            payload={"reset_url": reset_url},
            idempotency_key=key,
        )

    @staticmethod
    def send_invitation_email(
        to_email: str,
        *,
        accept_url: str,
        inviter_name: str,
        client_name: str,
    ) -> None:
        key = EmailService.build_idempotency_key("invitation", to_email, accept_url)
        EmailService._enqueue(
            kind="invitation",
            recipient=to_email,
            template="invitation",
            payload={
                "accept_url": accept_url,
                "inviter_name": inviter_name,
                "client_name": client_name,
            },
            idempotency_key=key,
        )

    @staticmethod
    def send_proposal_email(
        to_email: str,
        *,
        client_name: str,
        price_str: str,
        message: str,
        proposal_url: str,
    ) -> None:
        key = EmailService.build_idempotency_key("proposal", to_email, proposal_url)
        EmailService._enqueue(
            kind="proposal",
            recipient=to_email,
            template="proposal",
            payload={
                "client_name": client_name,
                "price_str": price_str,
                "message": message,
                "proposal_url": proposal_url,
            },
            idempotency_key=key,
        )

    @staticmethod
    def send_task_delivery_email(
        to_email: str,
        *,
        client_name: str,
        message: str,
        attachments: list | None = None,
    ) -> None:
        key = EmailService.build_idempotency_key("task_delivery", to_email)
        EmailService._enqueue(
            kind="task_delivery",
            recipient=to_email,
            template="task_delivery",
            payload={
                "client_name": client_name,
                "message": message,
                "attachments": attachments or [],
            },
            idempotency_key=key,
        )
