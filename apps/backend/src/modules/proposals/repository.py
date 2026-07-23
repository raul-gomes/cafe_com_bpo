from typing import List, Optional
from sqlalchemy.orm import Session
from .models import PricingScenario
from .schemas import ProposalCreate, ProposalUpdate
import uuid


class PricingScenarioRepository:
    """
    Repositório para gerenciar operações da entidade PricingScenario.
    """

    def __init__(self, session: Session):
        self.session = session

    def create_scenario(
        self,
        user_id: uuid.UUID,
        client_name: str,
        input_payload: dict,
        result_payload: dict,
    ) -> PricingScenario:
        scenario = PricingScenario(
            user_id=user_id,
            client_name=client_name,
            input_payload=input_payload,
            result_payload=result_payload,
        )
        self.session.add(scenario)
        self.session.flush()
        return scenario

    def list_scenarios_by_user(self, user_id: uuid.UUID) -> List[PricingScenario]:
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.user_id == user_id,
                PricingScenario.is_active,
            )
            .all()
        )

    def get_scenario_by_id(
        self, user_id: uuid.UUID, scenario_id: uuid.UUID
    ) -> Optional[PricingScenario]:
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.id == scenario_id,
                PricingScenario.user_id == user_id,
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
    ) -> Optional[PricingScenario]:
        scenario = self.get_scenario_by_id(user_id=user_id, scenario_id=scenario_id)
        if not scenario:
            return None

        scenario.client_name = client_name
        scenario.input_payload = input_payload
        scenario.result_payload = result_payload

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


class ProposalRepository:
    """
    Repository interface for ProposalService operations on PricingScenario.
    """

    def __init__(self, session: Session):
        self.session = session

    def get_by_user(
        self, user_id: uuid.UUID, status_filter: Optional[str] = None
    ) -> List[PricingScenario]:
        query = self.session.query(PricingScenario).filter(
            PricingScenario.user_id == user_id,
            PricingScenario.is_active,
        )
        return query.all()

    def get_by_id(
        self, proposal_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[PricingScenario]:
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.id == proposal_id,
                PricingScenario.user_id == user_id,
                PricingScenario.is_active,
            )
            .first()
        )

    def create(self, data: ProposalCreate, user_id: uuid.UUID) -> PricingScenario:
        scenario = PricingScenario(
            user_id=user_id,
            client_name=data.client_name,
            input_payload=data.input_payload,
            result_payload=data.result_payload,
        )
        self.session.add(scenario)
        self.session.flush()
        self.session.refresh(scenario)
        return scenario

    def update(
        self, scenario: PricingScenario, data: ProposalUpdate
    ) -> PricingScenario:
        if data.client_name is not None:
            scenario.client_name = data.client_name
        if data.input_payload is not None:
            scenario.input_payload = data.input_payload
        if data.result_payload is not None:
            scenario.result_payload = data.result_payload
        self.session.flush()
        self.session.refresh(scenario)
        return scenario

    def delete(self, scenario: PricingScenario) -> None:
        from datetime import datetime, timezone

        scenario.is_active = False
        scenario.deleted_at = datetime.now(timezone.utc)
        self.session.flush()
