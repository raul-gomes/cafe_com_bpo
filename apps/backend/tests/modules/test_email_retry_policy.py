"""Testes da política de retry e classificação de erros (TDD)."""

from datetime import datetime, timezone

import pytest

from src.modules.emails.retry_policy import (
    BACKOFF_INTERVALS_SECONDS,
    PermanentError,
    RetryableError,
    decide,
    is_retryable_error,
    next_backoff_datetime,
)


class TestRetryableErrorClassification:
    def test_retryable_explicit_type_is_retryable(self):
        assert is_retryable_error(RetryableError("timeout")) is True

    def test_permanent_explicit_type_is_not_retryable(self):
        assert is_retryable_error(PermanentError("invalid email")) is False

    @pytest.mark.parametrize(
        "message",
        [
            "HTTP Error 500: Internal Server Error",
            "HTTP Error 502: Bad Gateway",
            "HTTP Error 503: Service Unavailable",
            "HTTP Error 504: Gateway Timeout",
            "HTTP Error 429: Too Many Requests",
            "RateLimitError: rate limit exceeded",
            "connection reset by peer",
            "timed out after 10 seconds",
        ],
    )
    def test_temporary_failures_are_retryable(self, message):
        assert is_retryable_error(Exception(message)) is True

    @pytest.mark.parametrize(
        "message",
        [
            "HTTP Error 400: validation_error",
            "HTTP Error 401: missing_api_key",
            "HTTP Error 403: invalid_api_key",
            "Invalid email address format",
        ],
    )
    def test_permanent_failures_are_not_retryable(self, message):
        assert is_retryable_error(Exception(message)) is False


class TestBackoff:
    def test_first_retry_uses_30_seconds(self):
        now = datetime.now(timezone.utc)
        scheduled = next_backoff_datetime(1)
        delta = (scheduled - now).total_seconds()
        assert delta == pytest.approx(BACKOFF_INTERVALS_SECONDS[0], abs=2)

    def test_backoff_increases_with_attempts(self):
        first = next_backoff_datetime(1)
        second = next_backoff_datetime(2)
        assert (second - first).total_seconds() > 0

    def test_backoff_caps_at_last_interval(self):
        last = next_backoff_datetime(99)
        max_interval = BACKOFF_INTERVALS_SECONDS[-1]
        now = datetime.now(timezone.utc)
        assert (last - now).total_seconds() == pytest.approx(max_interval, abs=2)


class TestDecide:
    def test_retryable_error_schedules_retry(self):
        decision = decide(RetryableError("timeout"), current_attempts=1)
        assert decision.retry is True
        assert decision.scheduled_at is not None

    def test_permanent_error_goes_to_dead_letter(self):
        decision = decide(PermanentError("invalid email"), current_attempts=1)
        assert decision.retry is False

    def test_attempts_exceeded_goes_to_dead_letter(self):
        decision = decide(RetryableError("still failing"), current_attempts=5)
        assert decision.retry is False

    def test_5xx_retryable_schedules(self):
        decision = decide(
            Exception("HTTP Error 503: Service Unavailable"), current_attempts=1
        )
        assert decision.retry is True

    def test_error_message_preserved(self):
        decision = decide(PermanentError("bad address"), current_attempts=1)
        assert "bad address" in decision.error
