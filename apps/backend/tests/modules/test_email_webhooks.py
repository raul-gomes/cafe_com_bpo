"""Testes do webhook de provedor de e-mail (TDD)."""

from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from src.modules.emails.repository import EmailDeliveryRepository
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


def _make_delivery(session, *, key=None):
    repo = EmailDeliveryRepository(session)
    d = repo.create(
        kind="notification",
        recipient="a@example.com",
        template="notification",
        payload={},
        idempotency_key=key or f"hook-{uuid4()}",
    )
    session.commit()
    return d


class TestWebhookHandler:
    def test_delivered_event_marks_sent(self, session):
        d = _make_delivery(session)
        from src.modules.emails.worker import handle_webhook_event

        handle_webhook_event(str(d.id), "delivered")
        session.expire_all()
        session.refresh(d)
        assert d.status == "sent"

    def test_bounced_event_marks_bounced(self, session):
        d = _make_delivery(session)
        from src.modules.emails.worker import handle_webhook_event

        handle_webhook_event(str(d.id), "bounced")
        session.expire_all()
        session.refresh(d)
        assert d.status == "bounced"

    def test_complained_event_marks_complained(self, session):
        d = _make_delivery(session)
        from src.modules.emails.worker import handle_webhook_event

        handle_webhook_event(str(d.id), "complained")
        session.expire_all()
        session.refresh(d)
        assert d.status == "complained"

    def test_unknown_event_ignored(self, session):
        d = _make_delivery(session)
        from src.modules.emails.worker import handle_webhook_event

        handle_webhook_event(str(d.id), "weird_event")
        session.expire_all()
        session.refresh(d)
        assert d.status == "pending"

    def test_unknown_delivery_ignored_without_error(self, session):
        from src.modules.emails.worker import handle_webhook_event

        handle_webhook_event(str(uuid4()), "delivered")  # não deve levantar


class TestWebhookIdempotency:
    def test_repeated_event_does_not_overwrite_sent(self, session):
        d = _make_delivery(session)
        from src.modules.emails.worker import handle_webhook_event

        handle_webhook_event(str(d.id), "delivered")
        # novo evento contraditório não deve rebaixar o status
        handle_webhook_event(str(d.id), "bounced")
        session.expire_all()
        session.refresh(d)
        assert d.status == "sent"
