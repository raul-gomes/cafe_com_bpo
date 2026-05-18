from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated, List
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.core.logger import log
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from .schemas import CompanyCreate, CompanyUpdate, CompanyResponse
from .repository import CompanyRepository

router = APIRouter(prefix="/companies", tags=["companies"])


def get_company_repository(
    session: Annotated[Session, Depends(get_db_session)],
) -> CompanyRepository:
    return CompanyRepository(session)


CompanyRepoDep = Annotated[CompanyRepository, Depends(get_company_repository)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.get("/", response_model=List[CompanyResponse])
def get_companies(repo: CompanyRepoDep, current_user: CurrentUserDep):
    """Retorna empresas do usuário atual"""
    return repo.get_by_user(current_user.id)


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_in: CompanyCreate, repo: CompanyRepoDep, current_user: CurrentUserDep
):
    """Cria uma nova empresa para o usuário atual"""
    new_company = repo.create(company_in, current_user.id)
    log.info(f"🏢 Empresa criada: {company_in.name} por usuário {current_user.email}")
    return new_company


@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: UUID,
    company_in: CompanyUpdate,
    repo: CompanyRepoDep,
    current_user: CurrentUserDep,
):
    """Atualiza dados da empresa"""
    company = repo.get_by_id(company_id, current_user.id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    updated_company = repo.update(company, company_in)
    return updated_company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: UUID, repo: CompanyRepoDep, current_user: CurrentUserDep
):
    """Remove uma empresa"""
    company = repo.get_by_id(company_id, current_user.id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    repo.delete(company)
    return None
