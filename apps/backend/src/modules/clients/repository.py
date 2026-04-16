from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from .models import Client
from .schemas import ClientCreate, ClientUpdate

class ClientRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, client_id: UUID, user_id: UUID) -> Optional[Client]:
        return self.session.query(Client).filter(Client.id == client_id, Client.user_id == user_id).first()

    def get_by_user(self, user_id: UUID) -> List[Client]:
        return self.session.query(Client).filter(Client.user_id == user_id, Client.deleted_at.is_(None)).order_by(Client.name).all()

    def create(self, client_in: ClientCreate, user_id: UUID) -> Client:
        client_data = client_in.model_dump()
        new_client = Client(**client_data, user_id=user_id)
        self.session.add(new_client)
        self.session.commit()
        self.session.refresh(new_client)
        return new_client

    def update(self, client: Client, client_in: ClientUpdate) -> Client:
        update_data = client_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(client, field, value)
        self.session.commit()
        self.session.refresh(client)
        return client

    def delete(self, client: Client) -> None:
        from datetime import datetime, timezone
        client.deleted_at = datetime.now(timezone.utc)
        self.session.commit()
