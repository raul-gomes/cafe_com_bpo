from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from .models import Company
from .schemas import CompanyCreate, CompanyUpdate


class CompanyRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, company_id: UUID, user_id: UUID) -> Optional[Company]:
        return (
            self.session.query(Company)
            .filter(Company.id == company_id, Company.user_id == user_id)
            .first()
        )

    def get_by_user(self, user_id: UUID) -> List[Company]:
        return (
            self.session.query(Company)
            .filter(Company.user_id == user_id)
            .order_by(Company.name)
            .all()
        )

    def create(self, company_in: CompanyCreate, user_id: UUID) -> Company:
        company_data = company_in.model_dump()
        new_company = Company(**company_data, user_id=user_id)
        self.session.add(new_company)
        self.session.commit()
        self.session.refresh(new_company)
        return new_company

    def update(self, company: Company, company_in: CompanyUpdate) -> Company:
        update_data = company_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(company, field, value)
        self.session.commit()
        self.session.refresh(company)
        return company

    def delete(self, company: Company) -> None:
        self.session.delete(company)
        self.session.commit()
