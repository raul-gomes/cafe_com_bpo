"""
Governança Module - Repository Layer

Consulta as entidades de outros módulos (prospects, pricing_scenarios,
contracts) diretamente, como camada de agregação (sem modelos próprios).
"""

from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.modules.companies.models import Company
from src.modules.contacts.models import Contact
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect


class GovernancaRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_representative(self, prospect: Prospect) -> dict[str, str | None]:
        """Representante do negócio — Fase 4: fonte é `Contact`, com as
        colunas legadas `prospect.representante_*` como fallback."""
        company_id = prospect.converted_client_id or prospect.id
        company = self.session.get(Company, company_id)
        contact = None
        if company is not None and company.primary_contact_id is not None:
            contact = self.session.get(Contact, company.primary_contact_id)
        if contact is not None and contact.is_active:
            return {
                "nome": contact.nome,
                "cargo": contact.cargo,
                "cpf": contact.cpf,
                "email": contact.email,
                "telefone": contact.telefone,
            }
        return {
            "nome": prospect.representante_nome,
            "cargo": prospect.representante_cargo,
            "cpf": prospect.representante_cpf,
            "email": prospect.representante_email,
            "telefone": prospect.representante_telefone,
        }

    def get_prospects(self, user_id: UUID) -> list[Prospect]:
        """Prospectos do usuário que representam negócios vivos na
        Governança: ativos (negociação ou perdidos) **ou** já convertidos
        em Cliente (conquistados). Arquivos (inativos sem conversão) ficam
        de fora."""
        return (
            self.session.query(Prospect)
            .filter(
                Prospect.user_id == user_id,
                or_(
                    Prospect.is_active,
                    Prospect.converted_client_id.isnot(None),
                ),
            )
            .order_by(Prospect.name)
            .all()
        )

    def get_proposals(
        self, user_id: UUID, prospect_ids: list[UUID]
    ) -> list[PricingScenario]:
        if not prospect_ids:
            return []
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.user_id == user_id,
                PricingScenario.is_active,
                PricingScenario.prospect_id.in_(prospect_ids),
            )
            .order_by(PricingScenario.created_at.asc())
            .all()
        )

    def get_contracts(self, user_id: UUID, prospect_ids: list[UUID]) -> list[Contract]:
        if not prospect_ids:
            return []
        return (
            self.session.query(Contract)
            .filter(
                Contract.user_id == user_id,
                Contract.is_active,
                Contract.prospect_id.in_(prospect_ids),
            )
            .order_by(Contract.created_at.asc())
            .all()
        )
