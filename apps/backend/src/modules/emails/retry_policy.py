from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from src.core.config import get_settings


class RetryableError(Exception):
    """Erro temporário: deve ser tentado novamente (timeout, 429, 5xx, rede)."""


class PermanentError(Exception):
    """Erro definitivo: não deve ser tentado novamente (endereço/domínio inválido, etc.)."""


# Backoff inicial conforme documento: 30s, 2m, 10m, 1h, 6h
BACKOFF_INTERVALS_SECONDS = [30, 120, 600, 3600, 21600]


@dataclass
class RetryDecision:
    retry: bool
    scheduled_at: datetime | None = None
    error: str = ""


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_retryable_error(error: Exception) -> bool:
    """Classifica o erro como temporário (True) ou definitivo (False).

    Erros HTTP 5xx, timeout, 429 e problemas de rede são temporários.
    Qualquer outro erro é tratado como permanente para evitar loops
    infinitos em erros de configuração/payload.
    """
    if isinstance(error, RetryableError):
        return True
    if isinstance(error, PermanentError):
        return False

    msg = str(error).lower()
    http_5xx = any(code in msg for code in ("500", "502", "503", "504"))
    http_429 = any(
        hint in msg for hint in ("429", "rate limit", "rate_limit", "too many requests")
    )
    network = any(
        hint in msg
        for hint in (
            "timeout",
            "timed out",
            "connection reset",
            "connection aborted",
            "temporarily",
            "temporary",
        )
    )
    return http_5xx or http_429 or network


def next_backoff_datetime(attempt_number: int) -> datetime:
    """Retorna o próximo scheduled_at baseado no número de tentativas já feitas.

    attempt_number é 1-based (quantas vezes já falhou).
    """
    index = min(attempt_number - 1, len(BACKOFF_INTERVALS_SECONDS) - 1)
    seconds = BACKOFF_INTERVALS_SECONDS[index]
    return _utcnow() + timedelta(seconds=seconds)


def decide(error: Exception, current_attempts: int) -> RetryDecision:
    """Decide entre reagendar, enviar para dead_letter ou marcar como definitivo."""
    max_attempts = get_settings().email_max_attempts
    error_text = str(error) or type(error).__name__

    if current_attempts >= max_attempts:
        return RetryDecision(retry=False, error=error_text)

    if is_retryable_error(error):
        return RetryDecision(
            retry=True,
            scheduled_at=next_backoff_datetime(current_attempts + 1),
            error=error_text,
        )

    return RetryDecision(retry=False, error=error_text)
