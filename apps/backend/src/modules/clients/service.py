"""
Clients Module - Service Layer

Business logic for client management.
Currently using Repository pattern directly in router,
but service layer added for future business logic.
"""

from uuid import UUID

from src.modules.clients.repository import ClientRepository
from src.modules.clients.schemas import ClientCreate, ClientResponse, ClientUpdate

# Fonte de verdade dos segmentos de clientes (vocabulário controlado).
# Exposto via GET /clients/segments — o front consome da API (não hardcoded).
# "Outro" (sempre por último) dispara o input de segmento personalizado no front.
CLIENT_SEGMENTS: list[str] = [
    "B2B - Tecnologia & Software",
    "B2B - Marketing & Comunicação",
    "B2B - Consultoria & Assessoria",
    "Saúde - Clínicas & Consultórios Médicos",
    "Saúde - Estética & Cosmiatria",
    "Comércio - E-commerce & Marketplace",
    "Comércio - Alimentação & Gastronomia",
    "Serviços - Advocacia & Jurídico",
    "Indústria & Construção Civil",
    "Outro",
]


class ClientService:
    """Service layer for client operations."""

    def __init__(self, repository: ClientRepository):
        self.repository = repository

    def get_user_clients(self, user_id: UUID) -> list[ClientResponse]:
        """Get all clients for a specific user."""
        return self.repository.get_by_user(user_id)

    def create_client(self, client_data: ClientCreate, user_id: UUID) -> ClientResponse:
        """Create a new client for a user."""
        return self.repository.create(client_data, user_id)

    def update_client(
        self, client_id: UUID, user_id: UUID, client_data: ClientUpdate
    ) -> ClientResponse:
        """Update an existing client."""
        client = self.repository.get_by_id(client_id, user_id)
        if not client:
            raise ValueError(f"Client {client_id} not found for user {user_id}")
        return self.repository.update(client, client_data)

    def delete_client(self, client_id: UUID, user_id: UUID) -> None:
        """Delete a client."""
        client = self.repository.get_by_id(client_id, user_id)
        if not client:
            raise ValueError(f"Client {client_id} not found for user {user_id}")
        self.repository.delete(client)
