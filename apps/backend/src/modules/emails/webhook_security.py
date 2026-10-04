"""Verificação de assinatura do webhook do Resend (padrão Svix).

O Resend assina cada chamada com o "Signing Secret" do dashboard em três
headers: `svix-id`, `svix-timestamp` e `svix-signature`
(`v1,<base64 do hmac-sha256>`). A assinatura cobre
`{svix_id}.{svix_timestamp}.{corpo bruto}`, então mexer em um byte do corpo
invalida a assinatura.

Sem essa checagem, `POST /webhooks/email-provider` aceitava qualquer POST: um
atacante forjava `bounced`/`complained` sobre um `email_id` e reescrevia o
status de entrega.

Duas decisões deliberadas:

- **Falha fechada.** Sem `RESEND_WEBHOOK_SECRET` configurado a assinatura não é
  conferida e a chamada é recusada. "Aceitar quando não há segredo" é o furo que
  corrigimos; o efeito colateral é o webhook parar de funcionar até o segredo ser
  cadastrado — que é o comportamento honesto.
- **Janela de tempo.** Um timestamp fora da tolerância é recusado, para que uma
  captura antiga não possa ser reenviada indefinidamente.
"""

import base64
import hashlib
import hmac
import time
from collections.abc import Iterable

# Tolerância igual à do Svix: 5 minutos.
TIMESTAMP_TOLERANCE_SECONDS = 300


def _now() -> int:
    """Returns the current unix timestamp in seconds.

    Isolated in its own function so tests can pin the clock instead of depending
    on wall time.

    Returns:
        Current unix seconds.
    """
    return int(time.time())


def compute_signature(secret: str, svix_id: str, timestamp: str, body: bytes) -> str:
    """Computes the expected Svix signature for a request.

    Args:
        secret: Resend signing secret.
        svix_id: Value of the `svix-id` header.
        timestamp: Value of the `svix-timestamp` header.
        body: Raw request body, exactly as received.

    Returns:
        The base64 signature to compare against the header.
    """
    signed_payload = f"{svix_id}.{timestamp}.".encode() + body
    digest = hmac.new(secret.encode(), signed_payload, hashlib.sha256).digest()
    return base64.b64encode(digest).decode()


def _versions_from_header(header: str) -> Iterable[str]:
    """Extracts every signature version present in the header.

    Args:
        header: Raw `svix-signature` header (space separated `version,signature`).

    Yields:
        Each signature value, whatever its version (rotation sends `v1` and `v2`).
    """
    for part in header.split():
        _version, _, signature = part.partition(",")
        if signature:
            yield signature


def verify_webhook_signature(
    headers: dict[str, str],
    body: bytes,
    secret: str,
    now: int | None = None,
) -> bool:
    """Decides whether a webhook call really comes from Resend.

    Args:
        headers: Request headers (case-insensitive lookup is up to the caller).
        body: Raw request body.
        secret: Configured signing secret.
        now: Unix seconds used for the freshness check; defaults to the clock.

    Returns:
        True only when a signature matches and the timestamp is fresh.
    """
    if not secret:
        return False

    signature_header = headers.get("svix-signature")
    svix_id = headers.get("svix-id")
    timestamp = headers.get("svix-timestamp")
    if not signature_header or not svix_id or not timestamp:
        return False

    try:
        sent_at = int(timestamp)
    except (TypeError, ValueError):
        return False

    reference = _now() if now is None else now
    if abs(reference - sent_at) > TIMESTAMP_TOLERANCE_SECONDS:
        return False

    expected = compute_signature(secret, svix_id, timestamp, body)
    return any(
        hmac.compare_digest(expected, candidate)
        for candidate in _versions_from_header(signature_header)
    )
