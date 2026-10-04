"""Testes do webhook do provedor (Resend) — por provider_message_id e router."""

import json
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


WEBHOOK_SECRET = "resend-signing-secret-for-tests"


def _post_signed(client, payload, secret=WEBHOOK_SECRET, timestamp=1_760_000_000):
    """Posts a webhook with a valid Svix signature.

    The endpoint refuses unsigned calls (SEC-9), so every router test has to
    sign the body it sends.

    Args:
        client: Test client of the app under test.
        payload: Webhook body.
        secret: Signing secret.
        timestamp: Unix seconds written in `svix-timestamp`.

    Returns:
        The HTTP response.
    """
    from src.modules.emails import webhook_security

    body = json.dumps(payload).encode()
    signature = webhook_security.compute_signature(
        secret, "msg_test", str(timestamp), body
    )
    with patch("src.modules.emails.webhook_security._now", return_value=timestamp):
        return client.post(
            "/webhooks/email-provider",
            content=body,
            headers={
                "svix-id": "msg_test",
                "svix-timestamp": str(timestamp),
                "svix-signature": f"v1,{signature}",
                "Content-Type": "application/json",
            },
        )


@pytest.fixture
def signed_webhook_env(monkeypatch):
    """Configures the Resend signing secret and isolates the settings cache.

    Args:
        monkeypatch: Pytest monkeypatch fixture.

    Yields:
        The configured secret.
    """
    from src.core.config import get_settings

    monkeypatch.setenv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET)
    get_settings.cache_clear()
    yield WEBHOOK_SECRET
    get_settings.cache_clear()


class TestWebhookRouter:
    def test_unsigned_webhook_is_refused(self):
        """SEC-9: the endpoint used to accept any POST, so anyone could rewrite
        a delivery status knowing an `email_id`."""
        from src.main import create_app

        client = TestClient(create_app())

        resp = client.post(
            "/webhooks/email-provider",
            json={"type": "email.bounced", "data": {"email_id": "pm-abc"}},
        )

        assert resp.status_code == 401

    def test_resend_payload_updates_status(self, signed_webhook_env):
        from src.main import create_app

        client = TestClient(create_app())

        with patch("src.modules.emails.router.handle_provider_message_event") as mock_h:
            mock_h.return_value = True
            resp = _post_signed(
                client,
                {
                    "type": "email.bounced",
                    "data": {"email_id": "pm-abc", "to": ["a@example.com"]},
                },
            )

        assert resp.status_code == 200
        assert resp.json()["status"] == "applied"
        mock_h.assert_called_once_with("pm-abc", "bounced")

    def test_irrelevant_event_ignored(self, signed_webhook_env):
        from src.main import create_app

        client = TestClient(create_app())
        resp = _post_signed(
            client, {"type": "email.opened", "data": {"email_id": "pm-abc"}}
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "ignored"

    def test_payload_without_email_id_ignored(self, signed_webhook_env):
        from src.main import create_app

        client = TestClient(create_app())
        resp = _post_signed(client, {"type": "email.delivered", "data": {}})
        assert resp.status_code == 200
