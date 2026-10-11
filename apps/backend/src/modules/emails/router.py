"""Rotas do módulo de e-mails — webhook do provedor.

Recebe eventos do Resend (delivered/bounced/complained) e sincroniza
o status em email_deliveries de forma idempotente.
"""

import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from src.core.config import get_settings
from src.core.logger import log

from .webhook_security import verify_webhook_signature
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
    """Recebe evento do provedor e atualiza a entrega correspondente.

    A assinatura (Svix) é conferida **antes** de qualquer escrita: sem ela,
    qualquer POST poderia reescrever o status de uma entrega, e `email_id` não é
    segredo (ele volta em todo erro de e-mail mostrado ao usuário). Sem
    `RESEND_WEBHOOK_SECRET` configurado a chamada é recusada.
    """
    body = await request.body()
    secret = get_settings().resend_webhook_secret
    if not verify_webhook_signature(dict(request.headers), body, secret):
        log.warning("[emails] webhook do provedor sem assinatura válida: recusado")
        return JSONResponse(status_code=401, content={"detail": "Não autorizado"})

    try:
        payload = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
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
