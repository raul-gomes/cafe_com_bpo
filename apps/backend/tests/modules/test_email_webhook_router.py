"""Testes do webhook do provedor (Resend) — por provider_message_id e router."""

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.core.database import Base
from src.modules.emails.repository import EmailDeliveryRepository
from src.modules.emails.worker import handle_provider_message_event
from tests.conftest import test_engine


@pytest.fixture(autouse=True)
def clean_email_table():
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


def _make_delivery(session, *, message_id="pm-x"):
    repo = EmailDeliveryRepository(session)
    d = repo.create(
        kind="notification",
        recipient="a@example.com",
        template="notification",
        payload={},
        idempotency_key=f"mx-{uuid4()}",
    )
    d.provider_message_id = message_id
    session.commit()
    return d


class TestProviderMessageWebhook:
    def test_bounced_by_provider_id(self, session):
        d = _make_delivery(session, message_id="pm-bounced")
        handle_provider_message_event("pm-bounced", "bounced")
        session.expire_all()
        session.refresh(d)
        assert d.status == "bounced"
        assert d.webhook_processed is True

    def test_delivered_by_provider_id(self, session):
        d = _make_delivery(session, message_id="pm-delivered")
        assert handle_provider_message_event("pm-delivered", "delivered") is True
        session.expire_all()
        session.refresh(d)
        assert d.status == "sent"

    def test_unknown_provider_id_returns_false(self, session):
        assert handle_provider_message_event("pm-nao-existe", "delivered") is False


class TestWebhookRouter:
    def test_resend_payload_updates_status(self):
        from src.main import create_app

        client = TestClient(create_app())

        with patch("src.modules.emails.router.handle_provider_message_event") as mock_h:
            mock_h.return_value = True
            resp = client.post(
                "/webhooks/email-provider",
                json={
                    "type": "email.bounced",
                    "data": {"email_id": "pm-abc", "to": ["a@example.com"]},
                },
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "applied"
        mock_h.assert_called_once_with("pm-abc", "bounced")

    def test_irrelevant_event_ignored(self):
        from src.main import create_app

        client = TestClient(create_app())
        resp = client.post(
            "/webhooks/email-provider",
            json={"type": "email.opened", "data": {"email_id": "pm-abc"}},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored"

    def test_payload_without_email_id_ignored(self):
        from src.main import create_app

        client = TestClient(create_app())
        resp = client.post(
            "/webhooks/email-provider",
            json={"type": "email.delivered", "data": {}},
        )
        assert resp.status_code == 200
