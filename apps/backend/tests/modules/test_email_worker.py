"""Testes do EmailWorker (TDD).

O worker busca pendentes, renderiza o template, chama o provider e
atualiza o status (sent / failed_retryable / dead_letter).
"""

from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from src.modules.emails.models import EmailDelivery
from src.modules.emails.repository import EmailDeliveryRepository
from src.modules.emails.worker import EmailWorker
from tests.conftest import test_engine


@pytest.fixture(autouse=True)
def clean_email_table():
    from src.core.database import Base

    s = Session(bind=test_engine)
    s.execute(Base.metadata.tables["email_deliveries"].delete())
    s.commit()
    s.close()
    yield


@pytest.fixture
def session():
    s = Session(bind=test_engine)
    yield s
    s.rollback()
    s.close()


def _enqueue(
    session,
    *,
    key,
    recipient="a@example.com",
    template="notification",
    kind="notification",
    payload=None,
):
    repo = EmailDeliveryRepository(session)
    d = repo.create(
        kind=kind,
        recipient=recipient,
        template=template,
        payload=payload or {"message": "olá", "action_url": "https://app.example.com"},
        idempotency_key=key,
    )
    session.commit()
    return d


class TestProcessBatch:
    def test_process_batch_marks_sent(self, session):
        _enqueue(session, key="w1")
        worker = EmailWorker(session)

        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.return_value = "provider-1"
            result = worker.process_batch(limit=10)

        assert result["processed"] == 1
        assert result["sent"] == 1
        session.expire_all()
        d = session.query(EmailDelivery).one()
        assert d.status == "sent"
        assert d.provider_message_id == "provider-1"

    def test_process_batch_renders_correct_template(self, session):
        _enqueue(session, key="w2", template="notification")
        worker = EmailWorker(session)

        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.return_value = "provider-2"
            worker.process_batch(limit=10)

        send_kwargs = provider.send.call_args.kwargs
        assert send_kwargs["to"] == "a@example.com"
        assert "olá" in send_kwargs["html"]
        assert "olá" in send_kwargs["text"]
        assert send_kwargs["idempotency_key"] == "w2"

    def test_retryable_error_schedules_retry(self, session):
        from src.modules.emails.retry_policy import RetryableError

        _enqueue(session, key="w3")
        worker = EmailWorker(session)

        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.side_effect = RetryableError("timeout")
            result = worker.process_batch(limit=10)

        assert result["processed"] == 1
        assert result["sent"] == 0
        session.expire_all()
        d = session.query(EmailDelivery).one()
        assert d.status == "failed_retryable"
        assert d.attempts == 1
        assert d.scheduled_at is not None

    def test_permanent_error_goes_to_dead_letter(self, session):
        from src.modules.emails.retry_policy import PermanentError

        _enqueue(session, key="w4")
        worker = EmailWorker(session)

        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.side_effect = PermanentError("domínio inválido")
            result = worker.process_batch(limit=10)

        assert result["dead_letter"] == 1
        session.expire_all()
        d = session.query(EmailDelivery).one()
        assert d.status == "dead_letter"
        assert "domínio inválido" in d.last_error

    def test_attempts_exhausted_goes_to_dead_letter(self, session):
        from src.modules.emails.retry_policy import RetryableError

        d = _enqueue(session, key="w5")
        d.attempts = 5  # já atingiu o máximo
        session.commit()
        worker = EmailWorker(session)

        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.side_effect = RetryableError("timeout")
            result = worker.process_batch(limit=10)

        assert result["dead_letter"] == 1
        session.expire_all()
        session.refresh(d)
        assert d.status == "dead_letter"

    def test_no_pending_returns_zeros(self, session):
        worker = EmailWorker(session)
        result = worker.process_batch(limit=10)
        assert result == {"processed": 0, "sent": 0, "failed": 0, "dead_letter": 0}

    def test_process_of_failed_retryable_is_retried(self, session):
        d = _enqueue(session, key="w6")
        d.status = "failed_retryable"
        session.commit()
        worker = EmailWorker(session)

        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.return_value = "provider-6"
            result = worker.process_batch(limit=10)

        assert result["sent"] == 1
        session.expire_all()
        session.refresh(d)
        assert d.status == "sent"


class TestRunOnce:
    def test_run_once_claims_and_cleans(self, session):
        _enqueue(session, key="r1")
        worker = EmailWorker(session)
        with patch("src.modules.emails.worker.get_provider") as mock_get:
            provider = mock_get.return_value
            provider.send.return_value = "provider-r1"
            result = worker.run_once()

        assert result["sent"] >= 1
