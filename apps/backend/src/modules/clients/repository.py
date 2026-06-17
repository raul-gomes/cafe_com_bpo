from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from .models import Client
from .schemas import ClientCreate, ClientUpdate
from src.modules.tasks.models import Task
from src.modules.proposals.models import PricingScenario


class ClientRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, client_id: UUID, user_id: UUID) -> Optional[Client]:
        return (
            self.session.query(Client)
            .filter(
                Client.id == client_id,
                Client.user_id == user_id,
                Client.is_active == True,
            )
            .first()
        )

    def get_by_user(self, user_id: UUID) -> List[Client]:
        return (
            self.session.query(Client)
            .filter(Client.user_id == user_id, Client.is_active == True)
            .order_by(Client.name)
            .all()
        )

    def create(self, client_in: ClientCreate, user_id: UUID) -> Client:
        client_data = client_in.model_dump()

        # Garante uma cor contrastante se não informada
        if not client_data.get("color"):
            import random

            palette = [
                "#3b82f6",
                "#8b5cf6",
                "#d946ef",
                "#f43f5e",
                "#06b6d4",
                "#10b981",
                "#6366f1",
            ]
            client_data["color"] = random.choice(palette)

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

        now = datetime.now(timezone.utc)

        # Soft delete do cliente
        client.is_active = False
        client.deleted_at = now

        # Cascade: soft delete de todas as tarefas vinculadas
        self.session.query(Task).filter(
            Task.client_id == client.id, Task.is_active == True
        ).update(
            {"is_active": False, "deleted_at": now}, synchronize_session="fetch"
        )

        # Cascade: soft delete de todos os orçamentos vinculados via FK
        self.session.query(PricingScenario).filter(
            PricingScenario.client_id == client.id,
            PricingScenario.is_active == True,
        ).update(
            {"is_active": False, "deleted_at": now}, synchronize_session="fetch"
        )

        self.session.commit()
