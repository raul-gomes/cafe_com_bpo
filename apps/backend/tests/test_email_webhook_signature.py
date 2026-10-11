"""Regressões de assinatura do webhook do Resend (SEC-9 / WEB-2).

`POST /webhooks/email-provider` aceitava qualquer POST e escrevia o status de
entrega: um atacante que descobrisse um `email_id` (ele volta em todo erro de
e-mail enviado ao usuário) podia forjar `bounced`/`complained` e-sumir mensagens
como entregues, ou marcar uma entrega boa como falha.

O Resend assina o webhook no padrão Svix: `svix-id`, `svix-timestamp` e
`svix-signature` (`v1,<base64 hmac-sha256>` sobre `{svix_id}.{svix_timestamp}.
{body}`). A verificação exige o segredo configurado — sem ele a rota recusa
(falha fechada), e o timestamp fora da janela é recusado para o replay não valer
para sempre.
"""

import base64
import hashlib
import hmac
import json

import pytest

from src.modules.emails import webhook_security as security

SECRET = "resend-signing-secret-for-tests"


@pytest.fixture
def webhook_secret(monkeypatch):
    """Sets the Resend signing secret and isolates the settings cache.

    Args:
        monkeypatch: Pytest monkeypatch fixture.

    Returns:
        The configured secret.
    """
    from src.core.config import get_settings

    monkeypatch.setenv("RESEND_WEBHOOK_SECRET", SECRET)
    get_settings.cache_clear()
    yield SECRET
    get_settings.cache_clear()


def _signed_body(
    secret: str = SECRET,
    timestamp: int = 1_760_000_000,
    event_id: str = "msg_1",
    payload: dict | None = None,
) -> tuple[dict, dict, bytes]:
    """Builds a body plus the matching Svix signature headers.

    Args:
        secret: Signing secret used to compute the HMAC.
        timestamp: Unix seconds written in `svix-timestamp`.
        event_id: Value of `svix-id`.
        payload: Webhook payload; defaults to a delivered event.

    Returns:
        Tuple of (json body, headers, raw body bytes).
    """
    body = json.dumps(
        payload or {"type": "email.delivered", "data": {"email_id": "email_123"}}
    ).encode()
    signed_payload = f"{event_id}.{timestamp}.".encode() + body
    signature = base64.b64encode(
        hmac.new(secret.encode(), signed_payload, hashlib.sha256).digest()
    ).decode()
    headers = {
        "svix-id": event_id,
        "svix-timestamp": str(timestamp),
        "svix-signature": f"v1,{signature}",
    }
    return body, headers, body


@pytest.fixture
def frozen_clock(monkeypatch):
    """Pins the verifier clock so the timestamp window is deterministic.

    Args:
        monkeypatch: Pytest monkeypatch fixture.

    Returns:
        The pinned unix timestamp.
    """
    pinned = 1_760_000_000
    monkeypatch.setattr(security, "_now", lambda: pinned)
    return pinned


def test_webhook_without_signature_is_refused(client):
    """The regression: any POST could rewrite a delivery status."""
    resp = client.post(
        "/webhooks/email-provider",
        json={"type": "email.bounced", "data": {"email_id": "email_123"}},
    )

    assert resp.status_code == 401, resp.text


def test_webhook_with_wrong_signature_is_refused(client, webhook_secret):
    """Knowing the header names is not authorization."""
    _body, headers, body = _signed_body(secret="outro-segredo")

    resp = client.post("/webhooks/email-provider", content=body, headers=headers)

    assert resp.status_code == 401, resp.text


def test_webhook_with_valid_signature_is_accepted(client, webhook_secret, frozen_clock):
    """The legitimate path keeps working."""
    _body, headers, body = _signed_body()

    resp = client.post("/webhooks/email-provider", content=body, headers=headers)

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] in ("applied", "not_found"), resp.text


def test_tampered_body_is_refused(client, webhook_secret, frozen_clock):
    """Signature covers the body: changing one byte invalidates it."""
    _body, headers, _body = _signed_body()
    tampered = json.dumps(
        {"type": "email.complained", "data": {"email_id": "email_123"}}
    ).encode()

    resp = client.post("/webhooks/email-provider", content=tampered, headers=headers)

    assert resp.status_code == 401, resp.text


def test_replayed_signature_expires(client, webhook_secret, frozen_clock):
    """An old but correctly signed call must stop being accepted."""
    _body, headers, body = _signed_body(timestamp=frozen_clock - 3600)

    resp = client.post("/webhooks/email-provider", content=body, headers=headers)

    assert resp.status_code == 401, resp.text


def test_webhook_is_refused_when_no_secret_is_configured(
    client, monkeypatch, frozen_clock
):
    """Fail closed: without a configured secret nobody is authenticated.

    Defaulting to "accept" is exactly what this regression is about.
    """
    from src.core.config import get_settings

    monkeypatch.setenv("RESEND_WEBHOOK_SECRET", "")
    get_settings.cache_clear()
    try:
        _body, headers, body = _signed_body()

        resp = client.post("/webhooks/email-provider", content=body, headers=headers)
    finally:
        get_settings.cache_clear()

    assert resp.status_code == 401, resp.text


def test_signature_accepts_multiple_versions(client, webhook_secret, frozen_clock):
    """Svix sends `v1,<sig>` and may add versions during a secret rotation."""
    _body, headers, body = _signed_body()
    headers = dict(headers)
    headers["svix-signature"] = f"v2,invalida {headers['svix-signature']}"

    resp = client.post("/webhooks/email-provider", content=body, headers=headers)

    assert resp.status_code == 200, resp.text
