"""
Governança Module - Repository Layer

Consulta as entidades de outros módulos (prospects, pricing_scenarios,
contracts) diretamente, como camada de agregação (sem modelos próprios).
"""

from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect


class GovernancaRepository:
    def __init__(self, session: Session):
        self.session = session

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
