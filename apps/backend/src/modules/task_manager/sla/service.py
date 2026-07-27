"""
SLA Module - Service Layer

Business logic for ClientSLA CRUD.
"""

from typing import List
from uuid import UUID

from ..schemas import (
    ClientSLACreate,
    ClientSLAUpdate,
    ClientSLAResponse,
)
from ..sla.repository import SLARepository
from src.core.logger import log


class SLAService:
    """Service layer for SLA operations."""

    def __init__(self, repository: SLARepository):
        self.repository = repository

    def get_client_slas(self, client_id: UUID) -> List[ClientSLAResponse]:
        slas = self.repository.get_slas_by_client(client_id)
        return [ClientSLAResponse.model_validate(s) for s in slas]

    def create_sla(self, sla_in: ClientSLACreate, user_id: UUID) -> ClientSLAResponse:
        sla = self.repository.create_sla(sla_in, user_id)
        log.info(
            f"⏱️ SLA criado: cliente {sla_in.client_id} / {sla_in.process_type} = {sla_in.sla_days}d"
        )
        return ClientSLAResponse.model_validate(sla)

    def update_sla(
        self, sla_id: UUID, user_id: UUID, sla_in: ClientSLAUpdate
    ) -> ClientSLAResponse:
        sla = self.repository.get_sla_by_id(sla_id)
        if not sla:
            raise ValueError(f"SLA {sla_id} not found")
        updated = self.repository.update_sla(sla, sla_in)
        return ClientSLAResponse.model_validate(updated)

    def delete_sla(self, sla_id: UUID) -> None:
        sla = self.repository.get_sla_by_id(sla_id)
        if not sla:
            raise ValueError(f"SLA {sla_id} not found")
        self.repository.delete_sla(sla)
