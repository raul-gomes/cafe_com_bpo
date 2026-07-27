"""
Routine Types Module - Service Layer

Business logic for RoutineType CRUD.
"""

from typing import List
from uuid import UUID

from ..schemas import (
    RoutineTypeCreate,
    RoutineTypeUpdate,
    RoutineTypeResponse,
)
from ..routine_types.repository import RoutineTypeRepository
from src.core.logger import log


class RoutineTypeService:
    """Service layer for routine type operations."""

    def __init__(self, repository: RoutineTypeRepository):
        self.repository = repository

    def create_routine_type(
        self, user_id: UUID, data: RoutineTypeCreate
    ) -> RoutineTypeResponse:
        obj = self.repository.create_routine_type(user_id, data)
        log.info(f"🏷️ Tipo de rotina criado: {obj.name} (user={user_id})")
        return RoutineTypeResponse.model_validate(obj)

    def list_routine_types(self, user_id: UUID) -> List[RoutineTypeResponse]:
        objs = self.repository.list_routine_types(user_id)
        return [RoutineTypeResponse.model_validate(o) for o in objs]

    def get_routine_type(self, type_id: UUID, user_id: UUID) -> RoutineTypeResponse:
        obj = self.repository.get_routine_type(type_id, user_id)
        if not obj:
            raise ValueError(f"RoutineType {type_id} not found")
        return RoutineTypeResponse.model_validate(obj)

    def update_routine_type(
        self, type_id: UUID, user_id: UUID, data: RoutineTypeUpdate
    ) -> RoutineTypeResponse:
        obj = self.repository.update_routine_type(type_id, user_id, data)
        if not obj:
            raise ValueError(f"RoutineType {type_id} not found")
        return RoutineTypeResponse.model_validate(obj)

    def delete_routine_type(self, type_id: UUID, user_id: UUID) -> None:
        if not self.repository.delete_routine_type(type_id, user_id):
            raise ValueError(f"RoutineType {type_id} not found")
        log.info(f"🗑️ Tipo de rotina removido: {type_id}")
