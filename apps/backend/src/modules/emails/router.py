"""Rotas do módulo de e-mails — webhook do provedor.

Recebe eventos do Resend (delivered/bounced/complained) e sincroniza
o status em email_deliveries de forma idempotente.
"""

from fastapi import APIRouter, Request

from src.core.logger import log

from .worker import handle_provider_message_event

router = APIRouter(prefix="/webhooks", tags=["emails"])

# Tipos de evento Resend que nos interessam (prefixo 'email.' ignorado)
_INTERESTING_EVENTS = {"delivered", "bounced", "complained"}


def _normalize_event_type(event_type: str) -> str | None:
    """Converte 'email.delivered' → 'delivered'; retorna None se for irrelevante."""
    event = event_type.split(".")[-1]
    return event if event in _INTERESTING_EVENTS else None


@router.post("/email-provider")
async def email_provider_webhook(request: Request):
    """Recebe evento do provedor e atualiza a entrega correspondente."""
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        return {"status": "ignored", "reason": "corpo inválido"}

    event_type = payload.get("type", "")
    event = _normalize_event_type(event_type)
    if not event:
        log.info(f"⚠️ Evento Resend ignorado: {event_type}")
        return {"status": "ignored", "reason": event_type}

    data = payload.get("data") or {}
    provider_message_id = data.get("email_id") or data.get("id")
    if not provider_message_id:
        log.warning("⚠️ Webhook Resend sem email_id/id")
        return {"status": "ignored", "reason": "sem email_id"}

    applied = handle_provider_message_event(provider_message_id, event)
    return {"status": "applied" if applied else "not_found"}
