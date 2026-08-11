"""Testes do EmailDeliveryRepository (fila, reserva, recuperação)."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.orm import Session

from src.modules.emails.repository import EmailDeliveryRepository
from tests.conftest import test_engine


@pytest.fixture(autouse=True)
def clean_email_table():
    """Limpa a tabela email_deliveries entre testes (engine compartilhado)."""
    from src.core.database import Base

    Base.metadata.tables["email_deliveries"].delete()
    s = Session(bind=test_engine)
    s.execute(Base.metadata.tables["email_deliveries"].delete())
    s.commit()
    s.close()
    yield


@pytest.fixture
def session():
    """Sessão limpa por teste (sem begin_nested para permitir commit)."""
    s = Session(bind=test_engine)
    yield s
    s.rollback()
    s.close()


def _make(repo, *, key=None, status="pending", scheduled_at=None):
    return repo.create(
        kind="password_reset",
        recipient="user@example.com",
        template="password_reset",
        payload={"reset_url": "https://app.example.com"},
        idempotency_key=key
        or f"key-{datetime.now(timezone.utc).timestamp()}-{id(repo)}",
    )


class TestCreate:
    def test_creates_pending_delivery(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="unique-key-1")
        session.commit()
        session.refresh(d)

        assert d.id is not None
        assert d.status == "pending"
        assert d.attempts == 0
        assert d.recipient == "user@example.com"

    def test_idempotency_key_unique(self, session):
        repo = EmailDeliveryRepository(session)
        _make(repo, key="same-key")
        session.commit()

        from sqlalchemy.exc import IntegrityError

        duplicate = EmailDeliveryRepository(session)
        with pytest.raises(IntegrityError):
            duplicate.create(
                kind="password_reset",
                recipient="other@example.com",
                template="password_reset",
                payload={},
                idempotency_key="same-key",
            )
            session.commit()

    def test_get_by_idempotency_key(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="find-key")
        session.commit()

        found = EmailDeliveryRepository(session).get_by_idempotency_key("find-key")
        assert found is not None
        assert found.id == d.id

    def test_get_by_idempotency_key_missing_returns_none(self, session):
        assert EmailDeliveryRepository(session).get_by_idempotency_key("nope") is None


class TestClaimBatch:
    def test_claims_pending_in_batch(self, session):
        repo = EmailDeliveryRepository(session)
        _make(repo, key="a")
        _make(repo, key="b")
        _make(repo, key="c")
        session.commit()

        cleaner = EmailDeliveryRepository(session)
        claimed = cleaner.claim_next_batch(limit=10)
        assert len(claimed) == 3
        assert all(c.status == "processing" for c in claimed)
        assert all(c.locked_at is not None for c in claimed)

    def test_claim_respects_limit(self, session):
        repo = EmailDeliveryRepository(session)
        for i in range(5):
            _make(repo, key=f"limit-{i}")
        session.commit()

        claimed = EmailDeliveryRepository(session).claim_next_batch(limit=2)
        assert len(claimed) == 2

    def test_claim_skips_processing(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="processing-one")
        session.commit()
        EmailDeliveryRepository(session).claim_next_batch(limit=10)

        # novo claim não deve pegar o que está processing
        claimed = EmailDeliveryRepository(session).claim_next_batch(limit=10)
        assert d.id not in [c.id for c in claimed]

    def test_claim_skips_sent(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="sent-one")
        session.commit()
        repo.mark_sent(d, "msg-123")

        claimed = EmailDeliveryRepository(session).claim_next_batch(limit=10)
        assert d.id not in [c.id for c in claimed]

    def test_claim_skips_future_scheduled(self, session):
        repo = EmailDeliveryRepository(session)
        d = repo.create(
            kind="notification",
            recipient="fut@example.com",
            template="notification",
            payload={},
            idempotency_key="future-one",
        )
        d.scheduled_at = datetime.now(timezone.utc) + timedelta(hours=1)
        session.commit()

        claimed = EmailDeliveryRepository(session).claim_next_batch(limit=10)
        assert d.id not in [c.id for c in claimed]


class TestReleaseStale:
    def test_releases_stale_processing(self, session):
        repo = EmailDeliveryRepository(session)
        from src.modules.emails.repository import _utcnow

        d = _make(repo, key="stale-one")
        d.status = "processing"
        d.locked_at = _utcnow() - timedelta(minutes=30)
        session.commit()

        released = EmailDeliveryRepository(session).release_stale_processing()
        assert released == 1
        session.refresh(d)
        assert d.status == "pending"
        assert d.locked_at is None

    def test_does_not_release_recent_processing(self, session):
        repo = EmailDeliveryRepository(session)
        from src.modules.emails.repository import _utcnow

        d = _make(repo, key="fresh-one")
        d.status = "processing"
        d.locked_at = _utcnow()
        session.commit()

        EmailDeliveryRepository(session).release_stale_processing()
        session.refresh(d)
        assert d.status == "processing"


class TestStatusMutations:
    def test_mark_sent(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="mark-sent")
        session.commit()
        repo.mark_sent(d, "provider-xyz")

        session.refresh(d)
        assert d.status == "sent"
        assert d.provider_message_id == "provider-xyz"
        assert d.sent_at is not None

    def test_mark_retryable(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="mark-retryable")
        session.commit()
        ts = datetime.now(timezone.utc) + timedelta(seconds=30)
        repo.mark_retryable(d, "boom", next_attempts=2, scheduled_at=ts)

        session.refresh(d)
        assert d.status == "failed_retryable"
        assert d.attempts == 2
        assert d.last_error == "boom"

    def test_mark_dead_letter(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="mark-dead")
        session.commit()
        repo.mark_dead_letter(d, "fatal")

        session.refresh(d)
        assert d.status == "dead_letter"
        assert d.last_error == "fatal"

    def test_webhook_status_update(self, session):
        repo = EmailDeliveryRepository(session)
        d = _make(repo, key="webhook-one")
        session.commit()

        ok = EmailDeliveryRepository(session).mark_status_from_webhook(d.id, "bounced")
        assert ok is True
        session.refresh(d)
        assert d.status == "bounced"

    def test_webhook_status_unknown_id(self, session):
        import uuid

        repo = EmailDeliveryRepository(session)
        assert repo.mark_status_from_webhook(uuid.uuid4(), "bounced") is False
