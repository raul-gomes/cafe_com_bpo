from fastapi import APIRouter, Depends, HTTPException
from typing import Annotated
from src.schemas import PricingCalculateRequest, PricingCalculateResponse
from src.services import PricingService

router = APIRouter(prefix="/api/pricing", tags=["pricing"])

def get_pricing_service() -> PricingService:
    # Dependency Injection isolada caso o Service evolua ou exija conexão DB atrelada.
    return PricingService()

PricingServiceDep = Annotated[PricingService, Depends(get_pricing_service)]

@router.post("/calculate", response_model=PricingCalculateResponse)
def calculate_pricing_endpoint(
    request: PricingCalculateRequest,
    service: PricingServiceDep
):
    """
    Recebe os insumos por HTTP JSON, repassa ao PricingService (Camada Application) 
    para ser orquestrado contra o Motor Contábil.

    Raises:
        HTTPException: Tratamentos de exceção controlados pela estrutura da API.
    """
    try:
        return service.calculate_pricing(request)
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="O cálculo do motor ainda não foi implementado.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
