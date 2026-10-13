"""
SLA Module - Service Layer

Business logic for ClientSLA CRUD.
"""

from uuid import UUID

from src.core.logger import log
from src.modules.companies.repository import CompanyRepository

from ..models import ClientSLA
from ..schemas import (
    ClientSLACreate,
    ClientSLAResponse,
    ClientSLAUpdate,
)
from ..sla.repository import SLARepository


class SLAService:
    """Service layer for SLA operations.

    An SLA is a setting of the company (how many days each process may take),
    so only the company owner reads or changes it. Ids come from the request
    and are untrusted; anything not owned answers like a missing record.
    """

    def __init__(self, repository: SLARepository):
        """Binds the service to its repository.

        Args:
            repository: SLA persistence.
        """
        self.repository = repository
        self.companies = CompanyRepository(repository.session)

    def _require_owned_company(self, client_id: UUID, user_id: UUID) -> None:
        """Fails unless the client company belongs to the caller.

        Args:
            client_id: Company id from the request.
            user_id: The caller.

        Raises:
            ValueError: When the company does not exist or is someone else's.
        """
        company = self.companies.get_client_by_id(client_id)
        if company is None or company.user_id != user_id:
            raise ValueError(f"Client {client_id} not found")

    def _owned_sla(self, sla_id: UUID, user_id: UUID) -> ClientSLA:
        """Loads an SLA of a company owned by the caller.

        Args:
            sla_id: SLA id from the route.
            user_id: The caller.

        Returns:
            The SLA.

        Raises:
            ValueError: When the SLA does not exist or is not the caller's.
        """
        sla = self.repository.get_sla_by_id(sla_id)
        not_found = ValueError(f"SLA {sla_id} not found")
        if not sla:
            raise not_found
        try:
            self._require_owned_company(sla.client_id, user_id)
        except ValueError:
            raise not_found from None
        return sla

    def get_client_slas(
        self, client_id: UUID, user_id: UUID
    ) -> list[ClientSLAResponse]:
        """Lists the SLAs of a company owned by the caller.

        Args:
            client_id: Company id.
            user_id: The caller.

        Returns:
            The SLAs.

        Raises:
            ValueError: When the company is not the caller's.
        """
        self._require_owned_company(client_id, user_id)
        slas = self.repository.get_slas_by_client(client_id)
        return [ClientSLAResponse.model_validate(s) for s in slas]

    def create_sla(self, sla_in: ClientSLACreate, user_id: UUID) -> ClientSLAResponse:
        """Creates an SLA for a company owned by the caller.

        Args:
            sla_in: Company, process and days.
            user_id: The caller.

        Returns:
            The new SLA.

        Raises:
            ValueError: When the company is not the caller's.
        """
        self._require_owned_company(sla_in.client_id, user_id)
        sla = self.repository.create_sla(sla_in, user_id)
        log.info(
            f"⏱️ SLA created: client {sla_in.client_id} / {sla_in.process_type} = {sla_in.sla_days}d"
        )
        return ClientSLAResponse.model_validate(sla)

    def update_sla(
        self, sla_id: UUID, user_id: UUID, sla_in: ClientSLAUpdate
    ) -> ClientSLAResponse:
        """Updates an SLA of a company owned by the caller.

        Args:
            sla_id: SLA id.
            user_id: The caller.
            sla_in: Fields to change.

        Returns:
            The updated SLA.

        Raises:
            ValueError: When the SLA does not exist or is not the caller's.
        """
        sla = self._owned_sla(sla_id, user_id)
        updated = self.repository.update_sla(sla, sla_in)
        return ClientSLAResponse.model_validate(updated)

    def delete_sla(self, sla_id: UUID, user_id: UUID) -> None:
        """Deletes an SLA of a company owned by the caller.

        Args:
            sla_id: SLA id.
            user_id: The caller.

        Raises:
            ValueError: When the SLA does not exist or is not the caller's.
        """
        sla = self._owned_sla(sla_id, user_id)
        self.repository.delete_sla(sla)
