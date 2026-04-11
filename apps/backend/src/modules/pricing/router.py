from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated
from .schemas import PricingCalculateRequest, PricingCalculateResponse
from .service import PricingService
from src.core.logger import log

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

def get_pricing_service() -> PricingService:
    return PricingService()

PricingServiceDep = Annotated[PricingService, Depends(get_pricing_service)]

@router.post("/calculate", response_model=PricingCalculateResponse)
def calculate_pricing_endpoint(
    request: PricingCalculateRequest,
    service: PricingServiceDep
):
    try:
        log.debug(f"🧮 Processando simulação para {request.operation.people_count} colaboradores.")
        result = service.calculate_pricing(request)
        log.info(f"✅ Precificação concluída: {result.final_price} | Margem: {request.desired_profit_margin}%")
        return result
    except NotImplementedError:
        log.error("❌ Erro: Motor de precificação pendente de implementação.")
        raise HTTPException(status_code=501, detail="O cálculo do motor ainda não foi implementado.")
    except Exception as e:
        log.error(f"❌ Erro na simulação: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
