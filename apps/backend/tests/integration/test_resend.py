"""Testes de integração com Resend (email real).

Roda APENAS com: pytest -m integration
Requer: RESEND_API_KEY no .env
Envia para: rsgomes86@gmail.com (sandbox Resend — só aceita este destinatário)
From: onboarding@resend.dev (sandbox — domínio próprio precisa estar verificado)
"""

import os

import pytest

from src.core.config import get_settings
from src.modules.emails.provider import ResendProvider

pytestmark = pytest.mark.integration

# Modo sandbox do Resend só aceita envio para o próprio e-mail da conta
TEST_EMAIL = "rsgomes86@gmail.com"

# Em sandbox, o "from" precisa ser onboarding@resend.dev
SANDBOX_FROM = "onboarding@resend.dev"


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    # Forçar from email para sandbox (domínio próprio pode não estar verificado)
    os.environ["RESEND_FROM_EMAIL"] = SANDBOX_FROM
    get_settings.cache_clear()
    s = get_settings()
    if not s.resend_api_key:
        pytest.skip("RESEND_API_KEY não configurado")
    return s


@pytest.fixture(scope="module")
def provider(settings):
    return ResendProvider()


class TestResendSend:
    def test_send_returns_message_id(self, provider):
        mid = provider.send(
            to=TEST_EMAIL,
            subject="[Café com BPO] Teste de integração",
            html="<p>Se você recebeu este e-mail, a integração com Resend está funcionando.</p>",
            text="Se você recebeu este e-mail, a integração com Resend está funcionando.",
            idempotency_key="integration-test-resend-001",
        )
        assert mid is not None
        assert mid != ""
        assert not mid.startswith("noop-")

    def test_send_with_invalid_email_raises_permanent(self, provider):
        from src.modules.emails.retry_policy import PermanentError

        with pytest.raises(PermanentError):
            provider.send(
                to="invalid-email-no-domain",
                subject="[Café com BPO] Teste inválido",
                html="<p>Este e-mail não deveria ser enviado.</p>",
                text="Este e-mail não deveria ser enviado.",
                idempotency_key="integration-test-resend-invalid-001",
            )

    def test_send_with_html_and_text(self, provider):
        mid = provider.send(
            to=TEST_EMAIL,
            subject="[Café com BPO] Teste HTML + Text",
            html="<h1>Olá</h1><p>Corpo em <strong>HTML</strong>.</p>",
            text="Olá\nCorpo em HTML.",
            idempotency_key="integration-test-resend-html-text-001",
        )
        assert mid is not None
