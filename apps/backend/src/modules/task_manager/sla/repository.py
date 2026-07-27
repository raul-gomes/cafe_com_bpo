from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from ..models import ClientSLA
from ..schemas import ClientSLACreate, ClientSLAUpdate


class SLARepository:
    def __init__(self, session: Session):
        self.session = session

    def get_slas_by_client(self, client_id: UUID) -> List[ClientSLA]:
        return (
            self.session.query(ClientSLA).filter(ClientSLA.client_id == client_id).all()
        )

    def get_sla_by_id(self, sla_id: UUID) -> Optional[ClientSLA]:
        return self.session.query(ClientSLA).filter(ClientSLA.id == sla_id).first()

    def get_sla_by_client_and_process(
        self, client_id: UUID, process_type: str
    ) -> Optional[ClientSLA]:
        return (
            self.session.query(ClientSLA)
            .filter(
                ClientSLA.client_id == client_id, ClientSLA.process_type == process_type
            )
            .first()
        )

    def create_sla(self, sla_in: ClientSLACreate, user_id: UUID) -> ClientSLA:
        data = sla_in.model_dump()
        sla = ClientSLA(**data, user_id=user_id)
        self.session.add(sla)
        self.session.commit()
        self.session.refresh(sla)
        return sla

    def update_sla(self, sla: ClientSLA, sla_in: ClientSLAUpdate) -> ClientSLA:
        data = sla_in.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(sla, field, value)
        self.session.commit()
        self.session.refresh(sla)
        return sla

    def delete_sla(self, sla: ClientSLA) -> None:
        self.session.delete(sla)
        self.session.commit()
