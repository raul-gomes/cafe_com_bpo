from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from .models import Prospect
from .schemas import ProspectCreate, ProspectUpdate


class ProspectRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, prospect_id: UUID, user_id: UUID) -> Prospect | None:
        return (
            self.session.query(Prospect)
            .filter(
                Prospect.id == prospect_id,
                Prospect.user_id == user_id,
                Prospect.is_active,
            )
            .first()
        )

    def get_by_user(self, user_id: UUID) -> list[Prospect]:
        """Prospectos ativos e ainda não convertidos (os que podem ser trabalhados)."""
        return (
            self.session.query(Prospect)
            .filter(
                Prospect.user_id == user_id,
                Prospect.is_active,
                Prospect.converted_client_id.is_(None),
            )
            .order_by(Prospect.name)
            .all()
        )

    def get_by_user_all(self, user_id: UUID) -> list[Prospect]:
        """Todos os prospectos ativos, incluindo os já convertidos (histórico)."""
        return (
            self.session.query(Prospect)
            .filter(Prospect.user_id == user_id, Prospect.is_active)
            .order_by(Prospect.name)
            .all()
        )

    def create(self, prospect_in: ProspectCreate, user_id: UUID) -> Prospect:
        prospect_data = prospect_in.model_dump()

        # Garante uma cor contrastante se não informada
        if not prospect_data.get("color"):
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
            prospect_data["color"] = random.choice(palette)

        new_prospect = Prospect(**prospect_data, user_id=user_id)
        self.session.add(new_prospect)
        self.session.commit()
        self.session.refresh(new_prospect)
        return new_prospect

    def update(self, prospect: Prospect, prospect_in: ProspectUpdate) -> Prospect:
        update_data = prospect_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(prospect, field, value)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect

    def delete(self, prospect: Prospect) -> None:
        prospect.is_active = False
        prospect.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def mark_converted(self, prospect: Prospect, client_id: UUID) -> Prospect:
        prospect.converted_client_id = client_id
        prospect.converted_at = datetime.now(timezone.utc)
        prospect.is_active = False
        prospect.deleted_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(prospect)
        return prospect
