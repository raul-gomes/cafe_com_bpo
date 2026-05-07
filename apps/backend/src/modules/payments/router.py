from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from typing import Annotated, List
from sqlalchemy.orm import Session
import uuid

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.service import get_current_user
from src.modules.auth.schemas import UserResponse
from src.modules.payments.schemas import CreateCustomerInput, CreatePaymentInput, PaymentResponse
from src.modules.payments.repository import PaymentRepository
from src.modules.payments.service import PaymentService

router = APIRouter(prefix="/api/payments", tags=["payments"])


def get_service(session: Annotated[Session, Depends(get_db_session)]) -> PaymentService:
    return PaymentService(PaymentRepository(session))


ServiceDep = Annotated[PaymentService, Depends(get_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/customer")
async def create_customer(
    customer_data: CreateCustomerInput,
    service: ServiceDep,
    current_user: CurrentUserDep,
):
    """Cria ou recupera um cliente no Asaas."""
    try:
        result = await service.create_customer_for_user(current_user.id, customer_data)
        return result
    except Exception as e:
        log.error(f"Erro ao criar cliente Asaas: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create", response_model=PaymentResponse, status_code=201)
async def create_payment(
    payload: dict,
    service: ServiceDep,
    current_user: CurrentUserDep,
    background_tasks: BackgroundTasks,
):
    """Cria um pagamento via Asaas."""
    try:
        payment_data = CreatePaymentInput(**payload["payment"])
        customer_info = CreateCustomerInput(**payload["customer"])
        
        payment = await service.create_payment(
            user_id=current_user.id,
            payment_data=payment_data,
            customer_info=customer_info,
        )
        
        return payment
    except Exception as e:
        log.error(f"Erro ao criar pagamento: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[PaymentResponse])
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
    """Recebe webhooks do Asaas."""
    try:
        body = await request.json()
        log.info(f"📦 Webhook Asaas recebido: {body}")
        
        payment = service.process_webhook(body)
        
        return {"status": "ok", "payment_id": str(payment.id) if payment else None}
    except Exception as e:
        log.error(f"Erro ao processar webhook Asaas: {str(e)}")
        return {"status": "error", "message": str(e)}
