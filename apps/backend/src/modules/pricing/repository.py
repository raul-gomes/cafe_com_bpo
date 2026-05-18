"""
Pricing Module - Repository Layer

Data access for pricing scenarios.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.pricing.models import PricingScenario


class PricingRepository:
    """Repository for pricing scenario operations."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, scenario_data: dict, user_id: UUID) -> PricingScenario:
        """Create a new pricing scenario."""
        scenario = PricingScenario(user_id=user_id, **scenario_data)
        self.session.add(scenario)
        self.session.commit()
        self.session.refresh(scenario)
        return scenario

    def get_by_id(self, scenario_id: UUID, user_id: UUID) -> Optional[PricingScenario]:
        """Get a scenario by ID for a specific user."""
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.id == scenario_id, PricingScenario.user_id == user_id
            )
            .first()
        )

    def get_by_user(self, user_id: UUID) -> List[PricingScenario]:
        """Get all scenarios for a user."""
        return (
            self.session.query(PricingScenario)
            .filter(PricingScenario.user_id == user_id)
            .order_by(PricingScenario.created_at.desc())
            .all()
        )

    def update(self, scenario: PricingScenario, update_data: dict) -> PricingScenario:
        """Update a pricing scenario."""
        for key, value in update_data.items():
            if hasattr(scenario, key):
                setattr(scenario, key, value)
        self.session.commit()
        self.session.refresh(scenario)
        return scenario

    def delete(self, scenario: PricingScenario) -> None:
        """Delete a pricing scenario."""
        self.session.delete(scenario)
        self.session.commit()
