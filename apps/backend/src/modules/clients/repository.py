from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.companies.deactivation import deactivate_company

from .models import Client
from .schemas import ClientCreate, ClientUpdate


class ClientRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, client_id: UUID, user_id: UUID) -> Client | None:
        return (
            self.session.query(Client)
            .filter(
                Client.id == client_id,
                Client.user_id == user_id,
                Client.is_active,
            )
            .first()
        )

    def get_by_user(self, user_id: UUID) -> list[Client]:
        return (
            self.session.query(Client)
            .filter(Client.user_id == user_id, Client.is_active)
            .order_by(Client.name)
            .all()
        )

    def get_by_id_unchecked(self, client_id: UUID) -> Client | None:
        """Get client without filtering by user_id (for team access checks)."""
        return (
            self.session.query(Client)
            .filter(Client.id == client_id, Client.is_active)
            .first()
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
        """Deactivates the client and every row that belongs to its company.

        Rule §16 (product owner, 2026-09-30): nothing is hard deleted. The
        client and its whole tree go to `is_active = false` with the same
        `deleted_at`, which is what keeps the history of "what existed while the
        company was active" answerable. The cascade is by `company_id`, in
        `companies.deactivation`, so prospect and client share one implementation.
        """
        now = datetime.now(timezone.utc)
        client.is_active = False
        client.deleted_at = now
        deactivate_company(self.session, client.id)
        self.session.commit()
