"""Regressões de segurança do webhook e da configuração do Asaas.

O webhook (`POST /payments/webhook`) aceitava qualquer POST: sem assinatura,
sem token. Quem soubesse um `paymentId` mandava `PAYMENT_RECEIVED` e o
pagamento virava "received", sem nenhuma credencial. Além disso o corpo inteiro
era logado (nome/CPF do pagador) e a resposta devolvia `str(e)`.

Cobrado aqui:

- assinatura por token compartilhado (`asaas-access-token`), comparada em tempo
  constante, e **falha fechada**: token não configurado recusa o webhook;
- idempotência por `id` do evento — o Asaas reenvia o mesmo evento, e reprocessar
  sobrescrevia o `webhook_data` com uma cópia nova;
- corpo do webhook fora do log e erro sem vazar interno;
- `ASAAS_BASE_URL` por ambiente, e produção apontando para sandbox **quebra** em
  vez de cobrar dinheiro no ambiente de teste.

Os testes da fronteira de `POST /payments/create` saíram junto com a rota
(Fase 9): o cobro direto foi aposentado pelo checkout hospedado, e o regressão
que as rotas continuam fora está em `test_billing_history.py`.
"""

from uuid import uuid4

import pytest

from src.core.config import Settings, get_settings
from src.modules.payments.models import Payment
from tests.helpers import create_test_user

WEBHOOK_TOKEN = "asaas-webhook-token-for-tests"


def _user_id(db_session, email: str):
    """Returns the id of a registered user without touching a detached instance.

    Args:
        db_session: Test database session.
        email: Email of the user.

    Returns:
        The user id.
    """
    from src.modules.auth.models import User

    found = db_session.query(User.id).filter_by(email=email.lower()).first()
    assert found is not None, f"usuário {email} não encontrado"
    return found[0]


@pytest.fixture
def payment(db_session):
    """Creates a pending payment owned by a fresh user.

    Args:
        db_session: Test database session.

    Returns:
        The pending `Payment` row.
    """
    owner_email = f"pay_{uuid4()}@cafe.com"
    create_test_user(email=owner_email, password="StrongPassword123!")
    row = Payment(
        user_id=_user_id(db_session, owner_email),
        amount=99.9,
        description="Mensalidade",
        payment_method="PIX",
        due_date="2026-10-20",
        asaas_customer_id="cus_123",
        asaas_payment_id="pay_asaas_123",
    )
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def webhook_settings(monkeypatch):
    """Configures the Asaas webhook token for the duration of a test.

    Args:
        monkeypatch: Pytest monkeypatch fixture.

    Returns:
        The reloaded settings instance.
    """
    monkeypatch.setenv("ASAAS_WEBHOOK_TOKEN", WEBHOOK_TOKEN)
    get_settings.cache_clear()
    yield get_settings()
    get_settings.cache_clear()


def _event(event_id: str, event_type: str = "PAYMENT_RECEIVED") -> dict:
    """Builds an Asaas webhook payload.

    Args:
        event_id: Asaas event id.
        event_type: Asaas event name.

    Returns:
        The webhook payload.
    """
    return {
        "id": event_id,
        "event": event_type,
        "payment": {"id": "pay_asaas_123", "status": "RECEIVED"},
    }


# ── assinatura ───────────────────────────────────────────────────────────────


def test_webhook_without_token_is_refused(
    client, payment, webhook_settings, db_session
):
    """The regression: any anonymous POST could mark a payment as received."""
    resp = client.post("/payments/webhook", json=_event("evt_1"))

    assert resp.status_code == 401, resp.text
    db_session.expire_all()
    assert db_session.get(Payment, payment.id).status == "pending"


def test_webhook_with_wrong_token_is_refused(
    client, payment, webhook_settings, db_session
):
    """Guessing the header name is not enough."""
    resp = client.post(
        "/payments/webhook",
        json=_event("evt_2"),
        headers={"asaas-access-token": "not-the-token"},
    )

    assert resp.status_code == 401, resp.text
    db_session.expire_all()
    assert db_session.get(Payment, payment.id).status == "pending"


def test_webhook_with_configured_token_is_accepted(
    client, payment, webhook_settings, db_session
):
    """The legitimate path keeps working."""
    resp = client.post(
        "/payments/webhook",
        json=_event("evt_3"),
        headers={"asaas-access-token": WEBHOOK_TOKEN},
    )

    assert resp.status_code == 200, resp.text
    db_session.expire_all()
    assert db_session.get(Payment, payment.id).status == "received"


def test_webhook_is_refused_when_no_token_is_configured(
    client, payment, monkeypatch, db_session
):
    """Fail closed: without a configured token the route must not accept anyone.

    Defaulting to "open when unset" is exactly how the hole got there.
    """
    monkeypatch.setenv("ASAAS_WEBHOOK_TOKEN", "")
    get_settings.cache_clear()
    try:
        resp = client.post("/payments/webhook", json=_event("evt_4"))
    finally:
        get_settings.cache_clear()

    assert resp.status_code == 401, resp.text
    assert db_session.get(Payment, payment.id).status == "pending"


# ── idempotência ─────────────────────────────────────────────────────────────


def test_replayed_event_is_idempotent(client, payment, webhook_settings, db_session):
    """Asaas retries the same event; reprocessing must not rewrite the row."""
    headers = {"asaas-access-token": WEBHOOK_TOKEN}

    first = client.post("/payments/webhook", json=_event("evt_5"), headers=headers)
    assert first.status_code == 200, first.text
    after_first = db_session.get(Payment, payment.id).webhook_data

    second = client.post("/payments/webhook", json=_event("evt_5"), headers=headers)

    assert second.status_code == 200, second.text
    db_session.expire_all()
    assert db_session.get(Payment, payment.id).webhook_data == after_first


def test_unknown_event_type_is_acknowledged_without_changing_status(
    client, payment, webhook_settings, db_session
):
    """An event we do not handle is a 200 with no side effect (Asaas retries 4xx)."""
    resp = client.post(
        "/payments/webhook",
        json=_event("evt_6", "PAYMENT_SPLIT"),
        headers={"asaas-access-token": WEBHOOK_TOKEN},
    )

    assert resp.status_code == 200, resp.text
    db_session.expire_all()
    assert db_session.get(Payment, payment.id).status == "pending"


def test_webhook_for_unknown_payment_is_acknowledged(client, payment, webhook_settings):
    """No leak: an unknown payment answers the same as a known one."""
    resp = client.post(
        "/payments/webhook",
        json={
            "id": "evt_7",
            "event": "PAYMENT_RECEIVED",
            "payment": {"id": "pay_nope"},
        },
        headers={"asaas-access-token": WEBHOOK_TOKEN},
    )

    assert resp.status_code == 200, resp.text
    assert "pay_nope" not in resp.text


# ── B8: ambiente do Asaas ────────────────────────────────────────────────────


def test_base_url_comes_from_settings(monkeypatch):
    """The base URL is per environment, not hardcoded to sandbox."""
    monkeypatch.setenv("ASAAS_BASE_URL", "https://api.asaas.com/api/v3")

    settings = Settings()

    assert settings.asaas_base_url == "https://api.asaas.com/api/v3"


def test_client_uses_configured_base_url(monkeypatch):
    """The client must not ignore the configured URL."""
    from src.core.asaas_client import AsaasClient

    monkeypatch.setenv("ASAAS_BASE_URL", "https://api.asaas.com/api/v3")
    get_settings.cache_clear()
    try:
        assert AsaasClient().base_url == "https://api.asaas.com/api/v3"
    finally:
        get_settings.cache_clear()


def test_production_pointing_to_sandbox_fails_loudly(monkeypatch):
    """Charging a real customer in the sandbox is silent data loss, so the
    misconfiguration has to break the boot instead of being ignored."""
    from src.core.asaas_client import AsaasClient

    monkeypatch.setenv("MODE", "production")
    monkeypatch.setenv("ASAAS_BASE_URL", "https://sandbox.asaas.com/api/v3")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValueError, match="sandbox"):
            AsaasClient()
    finally:
        get_settings.cache_clear()
