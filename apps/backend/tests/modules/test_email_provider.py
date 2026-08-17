"""Testes do provider de e-mail (TDD)."""

from unittest.mock import patch

import pytest

from src.modules.emails.provider import (
    MailpitProvider,
    NoopProvider,
    ResendProvider,
    get_provider,
)
from src.modules.emails.retry_policy import PermanentError, RetryableError


def _payload(**overrides):
    base = {
        "to": "user@example.com",
        "subject": "Assunto",
        "html": "<p>oi</p>",
        "text": "oi",
        "idempotency_key": "key-123",
    }
    base.update(overrides)
    return base


class TestNoopProvider:
    def test_returns_noop_id(self):
        provider = NoopProvider()
        assert provider.name == "noop"
        mid = provider.send(**_payload())
        assert mid == "noop-key-123"


class TestMailpitProvider:
    def test_returns_mailpit_id(self):
        provider = MailpitProvider()
        assert provider.name == "mailpit"
        with patch("smtplib.SMTP") as mock_smtp:
            mid = provider.send(**_payload())
        assert mid == "mailpit-key-123"
        mock_smtp.assert_called_once()
        mock_smtp.return_value.__enter__.return_value.sendmail.assert_called_once()

    def test_smtp_connection_error_is_retryable(self):
        provider = MailpitProvider()
        with (
            patch("smtplib.SMTP", side_effect=ConnectionError("no route to host")),
            pytest.raises(RetryableError),
        ):
            provider.send(**_payload())


class TestResendProviderErrorMapping:
    def test_rate_limit_is_retryable(self):
        from resend.exceptions import RateLimitError

        provider = ResendProvider()
        with (
            patch(
                "resend.Emails.send",
                side_effect=RateLimitError(
                    code=429,
                    message="too many",
                    error_type="rate_limit_exceeded",
                    headers={},
                ),
            ),
            pytest.raises(RetryableError),
        ):
            provider.send(**_payload())

    def test_validation_error_is_permanent(self):
        from resend.exceptions import ValidationError

        provider = ResendProvider()
        with (
            patch(
                "resend.Emails.send",
                side_effect=ValidationError(
                    code=400, message="bad", error_type="validation_error", headers={}
                ),
            ),
            pytest.raises(PermanentError),
        ):
            provider.send(**_payload())

    def test_invalid_api_key_is_permanent(self):
        from resend.exceptions import InvalidApiKeyError

        provider = ResendProvider()
        with (
            patch(
                "resend.Emails.send",
                side_effect=InvalidApiKeyError(
                    code=403,
                    message="bad key",
                    error_type="invalid_api_key",
                    headers={},
                ),
            ),
            pytest.raises(PermanentError),
        ):
            provider.send(**_payload())

    def test_network_error_is_retryable(self):
        provider = ResendProvider()
        with (
            patch(
                "resend.Emails.send", side_effect=ConnectionError("connection reset")
            ),
            pytest.raises(RetryableError),
        ):
            provider.send(**_payload())

    def test_success_returns_message_id(self):
        provider = ResendProvider()
        with patch("resend.Emails.send", return_value={"id": "msg-999"}):
            mid = provider.send(**_payload())
        assert mid == "msg-999"

    def test_success_without_id_uses_idempotency_key(self):
        provider = ResendProvider()
        with patch("resend.Emails.send", return_value={}):
            mid = provider.send(**_payload())
        assert mid == "key-123"


class TestGetProvider:
    def test_test_mode_returns_noop(self):
        with patch("src.modules.emails.provider.get_settings") as mock_settings:
            settings = mock_settings.return_value
            settings.mode = "test"
            settings.email_provider = "resend"
            provider = get_provider()
        assert isinstance(provider, NoopProvider)

    def test_mailpit_mode_returns_mailpit(self):
        with patch("src.modules.emails.provider.get_settings") as mock_settings:
            settings = mock_settings.return_value
            settings.mode = "development"
            settings.email_provider = "mailpit"
            provider = get_provider()
        assert isinstance(provider, MailpitProvider)

    def test_resend_mode_returns_resend(self):
        with patch("src.modules.emails.provider.get_settings") as mock_settings:
            settings = mock_settings.return_value
            settings.mode = "production"
            settings.email_provider = "resend"
            provider = get_provider()
        assert isinstance(provider, ResendProvider)

    def test_unknown_provider_raises_permanent(self):
        with patch("src.modules.emails.provider.get_settings") as mock_settings:
            settings = mock_settings.return_value
            settings.mode = "production"
            settings.email_provider = "kafka"
            with pytest.raises(PermanentError):
                get_provider()
