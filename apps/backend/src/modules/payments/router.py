import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.payments.repository import PaymentRepository
from src.modules.payments.schemas import (
    CreateCustomerInput,
    CreatePaymentRequest,
    PaymentResponse,
)
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


@router.post("/customer")
async def create_customer(
    customer_data: CreateCustomerInput,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Cria ou recupera um cliente no Asaas.

    Falha do provedor responde com mensagem segura; o detalhe vai para o log
    (a mensagem do provedor pode carregar a chave da API).
    """
    try:
        result = await service.create_customer_for_user(current_user.id, customer_data)
        return result
    except Exception as e:
        log.error(f"Erro ao criar cliente Asaas: {e!s}")
        raise HTTPException(
            status_code=400, detail="Não foi possível cadastrar o cliente no Asaas."
        )


@router.post("/create", response_model=PaymentResponse, status_code=201)
async def create_payment(
    payload: CreatePaymentRequest,
    service: ServiceDep,
    current_user: CurrentUserDep,
    background_tasks: BackgroundTasks,
):
    """Cria um pagamento via Asaas.

    O corpo é validado pelo schema (422 no que não bate), e a falha do provedor
    responde com mensagem segura em vez de `str(e)`.
    """
    try:
        payment = await service.create_payment(
            user_id=current_user.id,
            payment_data=payload.payment,
            customer_info=payload.customer,
        )

        return payment
    except Exception as e:
        log.error(f"Erro ao criar pagamento: {e!s}")
        raise HTTPException(
            status_code=400, detail="Não foi possível processar o pagamento."
        )


@router.get("/", response_model=list[PaymentResponse])
def list_payments(
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Lista pagamentos do usuário."""
    return service.get_user_payments(current_user.id)


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: str,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Obtém detalhes de um pagamento."""
    payment = service.get_payment(uuid.UUID(payment_id), current_user.id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    return payment


@router.post("/webhook")
async def asaas_webhook(
    request: Request,
    service: ServiceDep,
):
    """Recebe webhooks do Asaas.

    Exige o token compartilhado no header `asaas-access-token`: sem ele, o
    status de um pagamento virava o que qualquer POST quisesse. O corpo não é
    logado (dado pessoal do pagador) e a resposta não carrega erro interno.
    Evento já processado é idempotente; evento desconhecido responde 200 para o
    Asaas não reenviar indefinidamente.
    """
    if not service.verify_webhook_token(request.headers.get("asaas-access-token")):
        return JSONResponse(status_code=401, content={"detail": "Não autorizado"})

    try:
        body = await request.json()
        payment = service.process_webhook(body)

        if payment is None:
            log.info("[payments] webhook sem efeito (evento ou pagamento desconhecido)")
            return {"status": "ignored"}

        return {"status": "ok", "payment_id": str(payment.id)}
    except Exception as e:
        log.error(f"Erro ao processar webhook Asaas: {e!s}")
        return JSONResponse(status_code=200, content={"status": "ignored"})
