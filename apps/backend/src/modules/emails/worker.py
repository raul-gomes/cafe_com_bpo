"""
Worker de e-mail — processa a fila de email_deliveries.

Busca mensagens prontas, renderiza o template, chama o provider e
atualiza o status (sent / failed_retryable / dead_letter).
"""

import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from src.core.logger import log

from .provider import get_provider
from .repository import EmailDeliveryRepository
from .retry_policy import decide
from .templates import render_template


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EmailWorker:
    """Worker in-process que processa um lote de e-mails pendentes."""

    def __init__(self, session: Session):
        self.session = session

    def process_batch(self, limit: int = 20) -> dict[str, int]:
        """Processa um lote de mensagens prontas. Retorna métricas."""
        repo = EmailDeliveryRepository(self.session)
        claimed = repo.claim_next_batch(limit=limit)

        stats = {"processed": 0, "sent": 0, "failed": 0, "dead_letter": 0}
        provider = get_provider()

        for delivery in claimed:
            start = time.time()
            stats["processed"] += 1
            try:
                self._process_one(repo, delivery, provider)
                stats["sent"] += 1
            except Exception as error:
                self._handle_error(repo, delivery, error, stats)
            finally:
                duration_ms = (time.time() - start) * 1000
                log.info(
                    f"📧 email_delivery={delivery.id} kind={delivery.kind} "
                    f"status={delivery.status} duration={duration_ms:.1f}ms"
                )

        return stats

    def _process_one(self, repo, delivery, provider) -> None:
        subject, text, html = render_template(delivery.template, delivery.payload)

        attachments = delivery.payload.get("attachments")
        if not attachments:
            attachments = None

        message_id = provider.send(
            to=delivery.recipient,
            subject=subject,
            html=html,
            text=text,
            idempotency_key=delivery.idempotency_key,
            attachments=attachments,
        )
        repo.mark_sent(delivery, message_id)

    def _handle_error(self, repo, delivery, error, stats) -> None:
        """Aplica a política de retry e atualiza as métricas corretamente."""
        decision = decide(error, current_attempts=delivery.attempts + 1)
        if decision.retry:
            stats["failed"] += 1
            repo.mark_retryable(
                delivery,
                error=decision.error,
                next_attempts=delivery.attempts + 1,
                scheduled_at=decision.scheduled_at,
            )
        else:
            stats["dead_letter"] += 1
            repo.mark_dead_letter(delivery, decision.error)

    def run_once(self) -> dict[str, int]:
        """Executa um ciclo completo: limpa registros presos e processa."""
        repo = EmailDeliveryRepository(self.session)
        released = repo.release_stale_processing()
        if released:
            log.info(f"♻️ {released} registro(s) preso(s) em processing devolvidos")
        return self.process_batch()


# ============================================================
# Webhooks
# ============================================================

# Eventos do provedor -> status em email_deliveries
EVENT_STATUS_MAP = {
    "delivered": "sent",
    "bounced": "bounced",
    "complained": "complained",
}

# Status "finais" que não devem ser rebaixados por eventos posteriores
_FINAL_STATUSES = {"sent", "bounced", "complained"}


def _apply_event(session, repo, delivery, event: str) -> bool:
    """Aplica o evento do provedor a uma delivery, respeitando idempotência.

    - Ignora eventos desconhecidos.
    - Não rebaixa status final (ex: 'sent' não volta para 'bounced').
    """
    status = EVENT_STATUS_MAP.get(event)
    if not status:
        log.warning(f"⚠️ Evento de webhook desconhecido: {event}")
        return False

    if delivery.status in _FINAL_STATUSES:
        log.info(
            f"ℹ️ Webhook {event} ignorado: delivery {delivery.id} já está '{delivery.status}'"
        )
        return True

    delivery.status = status
    delivery.webhook_processed = True
    session.commit()
    log.info(f"📬 Webhook {event} → email_delivery={delivery.id}")
    return True


def handle_webhook_event(email_delivery_id: str, event: str) -> bool:
    """Processa um evento de webhook (idempotente) pela id interna."""
    from src.core.database import SessionLocal

    session = SessionLocal()
    try:
        repo = EmailDeliveryRepository(session)
        delivery = repo.get_by_id_str(email_delivery_id)
        if not delivery:
            log.warning(f"⚠️ Webhook para delivery inexistente: {email_delivery_id}")
            return False
        return _apply_event(session, repo, delivery, event)
    finally:
        session.close()


def handle_provider_message_event(provider_message_id: str, event: str) -> bool:
    """Processa um evento de webhook (idempotente) pelo id do provedor."""
    from src.core.database import SessionLocal

    session = SessionLocal()
    try:
        repo = EmailDeliveryRepository(session)
        delivery = repo.get_by_provider_message_id(provider_message_id)
        if not delivery:
            log.warning(
                f"⚠️ Webhook para provider_message_id inexistente: {provider_message_id}"
            )
            return False
        return _apply_event(session, repo, delivery, event)
    finally:
        session.close()
