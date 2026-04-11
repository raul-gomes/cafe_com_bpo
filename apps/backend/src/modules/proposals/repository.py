from typing import List, Optional
from sqlalchemy.orm import Session
from .models import PricingScenario
import uuid

class PricingScenarioRepository:
    """
    Repositório para gerenciar operações da entidade PricingScenario.
    """
    def __init__(self, session: Session):
        self.session = session

    def create_scenario(self, user_id: uuid.UUID, client_name: str, input_payload: dict, result_payload: dict) -> PricingScenario:
        scenario = PricingScenario(
            user_id=user_id,
            client_name=client_name,
            input_payload=input_payload,
            result_payload=result_payload
        )
        self.session.add(scenario)
        self.session.flush()
        return scenario

    def list_scenarios_by_user(self, user_id: uuid.UUID) -> List[PricingScenario]:
        return self.session.query(PricingScenario).filter(PricingScenario.user_id == user_id).all()

    def get_scenario_by_id(self, user_id: uuid.UUID, scenario_id: uuid.UUID) -> Optional[PricingScenario]:
        return self.session.query(PricingScenario).filter(
            PricingScenario.id == scenario_id,
            PricingScenario.user_id == user_id
        ).first()

    def delete_scenario(self, user_id: uuid.UUID, scenario_id: uuid.UUID) -> bool:
        scenario = self.get_scenario_by_id(user_id=user_id, scenario_id=scenario_id)
        if scenario:
            self.session.delete(scenario)
            self.session.flush()
            return True
        return False
