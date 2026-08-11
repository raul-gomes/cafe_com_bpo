from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.core.config import get_settings

from .models import EmailDelivery


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EmailDeliveryRepository:
    """
    Repositório de entregas de e-mail.

    Responsável por inserir mensagens pendentes, buscar mensagens prontas,
    reservar registros atomicamente e atualizar status/tentativas/erros.
    """

    def __init__(self, session: Session):
        self.session = session

    def create(
        self,
        *,
        kind: str,
        recipient: str,
        template: str,
        payload: dict,
        idempotency_key: str,
    ) -> EmailDelivery:
        delivery = EmailDelivery(
            kind=kind,
            recipient=recipient,
            template=template,
            payload=payload,
            idempotency_key=idempotency_key,
            status="pending",
        )
        self.session.add(delivery)
        self.session.flush()
        return delivery

    def get_by_id(self, delivery_id: UUID) -> EmailDelivery | None:
        return (
            self.session.query(EmailDelivery)
            .filter(EmailDelivery.id == delivery_id)
            .first()
        )

    def get_by_id_str(self, delivery_id: str) -> EmailDelivery | None:
        try:
            uuid_id = UUID(delivery_id)
        except (ValueError, TypeError):
            return None
        return self.get_by_id(uuid_id)

    def get_by_idempotency_key(self, key: str) -> EmailDelivery | None:
        return (
            self.session.query(EmailDelivery)
            .filter(EmailDelivery.idempotency_key == key)
            .first()
        )

    def get_by_provider_message_id(
        self, provider_message_id: str
    ) -> EmailDelivery | None:
        return (
            self.session.query(EmailDelivery)
            .filter(EmailDelivery.provider_message_id == provider_message_id)
            .first()
        )

    def _claim_candidates(self, limit: int) -> list[EmailDelivery]:
        now = _utcnow()
        return (
            self.session.query(EmailDelivery)
            .filter(
                or_(
                    EmailDelivery.status == "pending",
                    EmailDelivery.status == "failed_retryable",
                ),
                EmailDelivery.scheduled_at <= now,
            )
            .order_by(EmailDelivery.scheduled_at.asc())
            .limit(limit)
            .all()
        )

    def claim_next_batch(self, limit: int = 20) -> list[EmailDelivery]:
        """
        Reserva atomicamente um lote de mensagens prontas.

        A mudança de status para 'processing' é feita dentro da mesma
        transação; a exclusividade da chave de idempotência garante que
        uma mensagem não seja criada duas vezes.
        """
        claimed = []
        for candidate in self._claim_candidates(limit):
            candidate.status = "processing"
            candidate.locked_at = _utcnow()
            claimed.append(candidate)
        self.session.commit()
        return claimed

    def release_stale_processing(self) -> int:
        """Devolve registros presos em 'processing' para 'pending'."""
        timeout = timedelta(minutes=get_settings().email_delivery_timeout_minutes)
        stale_before = _utcnow() - timeout
        result = self.session.query(EmailDelivery).filter(
            EmailDelivery.status == "processing",
            EmailDelivery.locked_at.isnot(None),
            EmailDelivery.locked_at < stale_before,
        )
        count = result.count()
        result.update(
            {
                "status": "pending",
                "locked_at": None,
                "updated_at": _utcnow(),
            },
            synchronize_session=False,
        )
        self.session.commit()
        return count

    def mark_sent(self, delivery: EmailDelivery, provider_message_id: str) -> None:
        delivery.status = "sent"
        delivery.provider_message_id = provider_message_id
        delivery.locked_at = None
        delivery.last_error = None
        delivery.sent_at = _utcnow()
        self.session.commit()

    def mark_retryable(
        self,
        delivery: EmailDelivery,
        error: str,
        next_attempts: int,
        scheduled_at: datetime,
    ) -> None:
        delivery.status = "failed_retryable"
        delivery.attempts = next_attempts
        delivery.last_error = error
        delivery.locked_at = None
        delivery.scheduled_at = scheduled_at
        self.session.commit()

    def mark_dead_letter(self, delivery: EmailDelivery, error: str) -> None:
        delivery.status = "dead_letter"
        delivery.last_error = error
        delivery.locked_at = None
        self.session.commit()

    def mark_status_from_webhook(self, delivery_id: UUID, status: str) -> bool:
        delivery = self.get_by_id(delivery_id)
        if not delivery:
            return False
        delivery.status = status
        delivery.webhook_processed = True
        self.session.commit()
        return True

    def increment_attempts(self, delivery: EmailDelivery) -> int:
        delivery.attempts += 1
        self.session.flush()
        return delivery.attempts
