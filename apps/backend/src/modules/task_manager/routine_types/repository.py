from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from ..models import RoutineType, ActivityTemplate
from ..schemas import RoutineTypeCreate, RoutineTypeUpdate


class RoutineTypeRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_routine_type(
        self, user_id: UUID, data: RoutineTypeCreate
    ) -> RoutineType:
        obj = RoutineType(**data.model_dump(), user_id=user_id)
        self.session.add(obj)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def list_routine_types(self, user_id: UUID) -> List[RoutineType]:
        return (
            self.session.query(RoutineType)
            .filter(RoutineType.user_id == user_id)
            .order_by(RoutineType.name)
            .all()
        )

    def get_routine_type(self, type_id: UUID, user_id: UUID) -> Optional[RoutineType]:
        return (
            self.session.query(RoutineType)
            .filter(RoutineType.id == type_id, RoutineType.user_id == user_id)
            .first()
        )

    def update_routine_type(
        self, type_id: UUID, user_id: UUID, data: RoutineTypeUpdate
    ) -> Optional[RoutineType]:
        obj = self.get_routine_type(type_id, user_id)
        if not obj:
            return None
        for key, val in data.model_dump(exclude_unset=True).items():
            setattr(obj, key, val)
        self.session.commit()
        self.session.refresh(obj)
        return obj

    def delete_routine_type(self, type_id: UUID, user_id: UUID) -> bool:
        obj = self.get_routine_type(type_id, user_id)
        if not obj:
            return False
        # Set routine_type_id to NULL on templates that reference it
        self.session.query(ActivityTemplate).filter(
            ActivityTemplate.routine_type_id == type_id
        ).update({ActivityTemplate.routine_type_id: None})
        self.session.delete(obj)
        self.session.commit()
        return True
