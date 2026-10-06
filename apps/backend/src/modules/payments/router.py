from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.payments.models import Payment
from src.modules.payments.repository import PaymentRepository
from src.modules.payments.schemas import BillingHistoryRow
from src.modules.payments.service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


def get_service(session: Annotated[Session, Depends(get_db_session)]) -> PaymentService:
    """Builds the payments service for the request.

    Args:
        session: Database session bound to the request.

    Returns:
        The payments service.
    """
    return PaymentService(PaymentRepository(session))


ServiceDep = Annotated[PaymentService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/", response_model=list[BillingHistoryRow])
def list_payments(
    service: ServiceDep,
    current_user: CurrentUserDep,
) -> list[BillingHistoryRow]:
    """Lists the caller's billing history, month by month (§17.2).

    Only charges tied to a subscription reach the screen: legacy one-off rows
    stay in the table and out of the list, as the `Payment` model promises.
    Each row is the six-key contract the page reads (§6), mapped here — never
    a dump of the ORM.

    Args:
        service: Payments service.
        current_user: Authenticated user; the query is scoped to their id.

    Returns:
        The caller's history, newest paid month first.
    """
    return [
        _to_history_row(payment)
        for payment in service.get_billing_history(current_user.id)
    ]


def _to_history_row(payment: Payment) -> BillingHistoryRow:
    """Adapts a stored charge to the six-key contract the screen reads (§6).

    Args:
        payment: Stored `payments` row.

    Returns:
        The history row as the page renders it, money as text.
    """
    return BillingHistoryRow(
        id=payment.id,
        cycle_month=payment.cycle_month,
        amount=str(payment.amount),
        status=payment.status,
        paid_at=payment.paid_at,
        invoice_url=payment.invoice_url,
    )


@router.post("/webhook")
async def asaas_webhook(
    request: Request,
    service: ServiceDep,
):
    """Recebe webhooks do Asaas.

    Exige o token compartilhado no header `asaas-access-token`: sem ele, o
    status de um pagamento virava o que qualquer POST quisesse. O corpo não é
    logado (dado pessoal do pagador).

    A resposta carrega só `{"status"}` — Asaas lê o código HTTP, e um campo a
    mais seria um identificador interno saindo do serviço (§6). Evento já
    processado ou sem alvo responde **200** `ignored`, porque um não-2xx faz o
    provedor reenviar para sempre; uma falha inesperada responde **503**, porque
    um 200 enganoso descartaria o evento e o estado ficaria para sempre errado.
    """
    if not service.verify_webhook_token(request.headers.get("asaas-access-token")):
        return JSONResponse(status_code=401, content={"detail": "Não autorizado"})

    try:
        body = await request.json()
        outcome = await service.process_event(body)
        return {"status": outcome}
    except Exception as e:
        log.error(f"Erro ao processar webhook Asaas: {e!s}")
        return JSONResponse(status_code=503, content={"status": "retry"})
