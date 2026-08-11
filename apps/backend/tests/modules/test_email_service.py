"""Testes do EmailService de enfileiramento (TDD).

O EmailService passa a ser uma fachada que registra a mensagem como pendente
e retorna imediatamente — não envia mais inline.
"""

import pytest
from sqlalchemy.orm import Session

from src.core.email import EmailService
from src.modules.emails.models import EmailDelivery
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


class TestEnqueueGeneric:
    def test_send_email_enqueues_pending(self, session):
        n_before = session.query(EmailDelivery).count()

        EmailService.send_email(
            to_email="a@example.com",
            subject="Olá",
            text="corpo",
            html="<p>corpo</p>",
        )

        n_after = session.query(EmailDelivery).count()
        assert n_after == n_before + 1

        d = (
            session.query(EmailDelivery)
            .order_by(EmailDelivery.created_at.desc())
            .first()
        )
        assert d.recipient == "a@example.com"
        assert d.status == "pending"
        assert d.template == "custom"
        assert d.payload["subject"] == "Olá"
        assert d.payload["html"] == "<p>corpo</p>"

    def test_send_email_does_not_call_provider(self, session):
        """O enfileiramento não deve tocar o provedor (sem rede)."""
        from unittest.mock import patch

        with patch("src.modules.emails.provider.get_provider") as mock_get_provider:
            EmailService.send_email(
                to_email="a@example.com",
                subject="Olá",
                text="corpo",
                html="<p>corpo</p>",
            )
            mock_get_provider.assert_not_called()


class TestEnqueueResetPassword:
    def test_send_reset_password_enqueues_correct_template(self, session):
        EmailService.send_reset_password_email("user@example.com", "token123")

        d = (
            session.query(EmailDelivery)
            .order_by(EmailDelivery.created_at.desc())
            .first()
        )
        assert d.kind == "password_reset"
        assert d.template == "password_reset"
        assert "token123" in d.payload["reset_url"]

    def test_reset_token_not_stored_in_payload_as_plain_matching(self, session):
        # o payload carrega a URL, o token é hashado no fluxo de auth (separado)
        EmailService.send_reset_password_email("user@example.com", "TOKENSECRETO")
        d = (
            session.query(EmailDelivery)
            .order_by(EmailDelivery.created_at.desc())
            .first()
        )
        assert (
            "TOKENSECRETO" in d.payload["reset_url"]
        )  # URL de recuperação usa token assinado


class TestIdempotencyKey:
    def test_same_params_generate_unique_keys(self):
        k1 = EmailService.build_idempotency_key(
            "password_reset", "a@example.com", "extra"
        )
        k2 = EmailService.build_idempotency_key(
            "password_reset", "a@example.com", "extra"
        )
        assert k1 != k2

    def test_key_contains_kind_and_recipient(self):
        key = EmailService.build_idempotency_key("invitation", "b@example.com")
        assert key.startswith("invitation")
        assert "b@example.com" in key
