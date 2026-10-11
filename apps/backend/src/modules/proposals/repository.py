import uuid

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)

from .models import PricingScenario


def _apply_company_link(scenario: PricingScenario, company: Company | None) -> None:
    """Aponta o orçamento para a empresa dona do negócio e mantém a coluna
    legada em escrita dupla.

    `company_id` é a coluna que vale (R2): é por ela que a Governança agrupa e
    que a cascata de arquivamento (§16) desativa. `client_id`/`prospect_id` ainda
    são escritas em paralelo porque só o R4 as apaga — e o roteiro de release
    (V5) compara `company_id` com `coalesce(client_id, prospect_id)`, então uma
    linha nova escrita só com `company_id` nasceria como divergência no rehearsal.
    """
    scenario.company_id = company.id if company is not None else None
    scenario.client_id = (
        company.id
        if company is not None and company.type == COMPANY_TYPE_CLIENT
        else None
    )
    scenario.prospect_id = (
        company.id
        if company is not None and company.type == COMPANY_TYPE_PROSPECT
        else None
    )


class PricingScenarioRepository:
    """
    Repositório para gerenciar operações da entidade PricingScenario.
    """

    def __init__(self, session: Session):
        self.session = session

    def next_proposal_number(self, user_id: uuid.UUID) -> int:
        """Próximo número sequencial do orçamento para o usuário (por BPO)."""
        last = (
            self.session.query(func.max(PricingScenario.number))
            .filter(
                PricingScenario.user_id == user_id,
                PricingScenario.number.isnot(None),
            )
            .scalar()
        )
        return int(last or 0) + 1

    def create_scenario(
        self,
        user_id: uuid.UUID,
        client_name: str,
        input_payload: dict,
        result_payload: dict,
        company: Company | None = None,
    ) -> PricingScenario:
        scenario = PricingScenario(
            user_id=user_id,
            client_name=client_name,
            input_payload=input_payload,
            result_payload=result_payload,
            number=self.next_proposal_number(user_id),
        )
        _apply_company_link(scenario, company)
        self.session.add(scenario)
        self.session.flush()
        return scenario

    def list_scenarios_by_user(self, user_id: uuid.UUID) -> list[PricingScenario]:
        """Orçamentos ativos do usuário, **exceto** os vinculados a uma empresa
        já conquistada (convertida) ou não captada (reprovada) — esses saem da
        lista de orçamentos e passam a viver na Governança.

        O filtro lê o ciclo de vida de `companies`, não o de `prospects`: a
        empresa é o dono do negócio e a pairagem prospecto/cliente colapsa
        nela, então é o único lugar que responde "este negócio ainda está em
        negociação?" depois que o par vira uma linha só. A empresa inexistente
        (orçamento com nome livre, sem cadastro) entra sempre.
        """
        return (
            self.session.query(PricingScenario)
            .outerjoin(Company, PricingScenario.company_id == Company.id)
            .filter(
                PricingScenario.user_id == user_id,
                PricingScenario.is_active,
                or_(
                    Company.id.is_(None),
                    and_(
                        Company.converted_at.is_(None),
                        Company.reproved_at.is_(None),
                    ),
                ),
            )
            .order_by(PricingScenario.created_at.desc())
            .all()
        )

    def get_scenario_by_id(
        self, user_id: uuid.UUID, scenario_id: uuid.UUID
    ) -> PricingScenario | None:
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.id == scenario_id,
                PricingScenario.user_id == user_id,
                PricingScenario.is_active,
            )
            .first()
        )

    def get_by_public_hash(self, public_hash: str) -> PricingScenario | None:
        """Busca orçamento pelo hash público de compartilhamento."""
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.public_hash == public_hash,
                PricingScenario.is_active,
            )
            .first()
        )

    def update_scenario(
        self,
        user_id: uuid.UUID,
        scenario_id: uuid.UUID,
        client_name: str,
        input_payload: dict,
        result_payload: dict,
        company: Company | None = None,
    ) -> PricingScenario | None:
        """Atualiza o orçamento e **reaponta** o vínculo com a empresa.

        O PUT é um corpo inteiro (`ProposalCreate`), então `company=None`
        significa "orçamento sem empresa" — e não "não mexer no vínculo".
        """
        scenario = self.get_scenario_by_id(user_id=user_id, scenario_id=scenario_id)
        if not scenario:
            return None

        scenario.client_name = client_name
        scenario.input_payload = input_payload
        scenario.result_payload = result_payload
        _apply_company_link(scenario, company)

        self.session.flush()
        return scenario

    def delete_scenario(self, user_id: uuid.UUID, scenario_id: uuid.UUID) -> bool:
        from datetime import datetime, timezone

        scenario = self.get_scenario_by_id(user_id=user_id, scenario_id=scenario_id)
        if scenario:
            scenario.is_active = False
            scenario.deleted_at = datetime.now(timezone.utc)
            self.session.flush()
            return True
        return False

    def delete_by_company(
        self, user_id: uuid.UUID, company_id: uuid.UUID
    ) -> list[PricingScenario]:
        """Arquiva (soft delete) os orçamentos ativos do usuário vinculados a
        uma empresa — usado quando a empresa é arquivada, para o vínculo sair de
        vista do usuário e o link público compartilhado deixar de valer.

        Filtra por `company_id`, a coluna que vale (R2). Quem chama precisa
        passar a empresa que **sobreviveu** à conversão (`converted_client_id`),
        porque a empresa do prospecto convertido não existe mais em `companies`.
        """
        from datetime import datetime, timezone

        scenarios = (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.user_id == user_id,
                PricingScenario.company_id == company_id,
                PricingScenario.is_active,
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for scenario in scenarios:
            scenario.is_active = False
            scenario.deleted_at = now
        self.session.commit()
        return scenarios
