from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.roi.models import RoiSimulation


class RoiRepository:
    def __init__(self, session: Session):
        self.session = session

    def create(self, simulation: RoiSimulation) -> RoiSimulation:
        self.session.add(simulation)
        self.session.commit()
        self.session.refresh(simulation)
        return simulation

    def get_by_user(self, user_id: UUID) -> List[RoiSimulation]:
        return (
            self.session.query(RoiSimulation)
            .filter(RoiSimulation.user_id == user_id)
            .order_by(RoiSimulation.created_at.desc())
            .all()
        )

    def get_by_id(self, simulation_id: UUID, user_id: UUID) -> Optional[RoiSimulation]:
        return (
            self.session.query(RoiSimulation)
            .filter(RoiSimulation.id == simulation_id, RoiSimulation.user_id == user_id)
            .first()
        )

    def delete(self, simulation: RoiSimulation) -> None:
        self.session.delete(simulation)
        self.session.commit()
