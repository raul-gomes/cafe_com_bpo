"""
Network Module - Service Layer

Business logic for network/connections management.
"""

from typing import List, Optional
from uuid import UUID

from src.modules.network.repository import NetworkRepository
from src.modules.network.schemas import (
    ConnectionCreate, ConnectionResponse, 
    NetworkRequestCreate, NetworkRequestResponse
)
from src.modules.auth.schemas import UserResponse


class NetworkService:
    """Service layer for network operations."""
    
    def __init__(self, repository: NetworkRepository):
        self.repository = repository
    
    def get_user_connections(self, user_id: UUID) -> List[ConnectionResponse]:
        """Get all connections for a user."""
        return self.repository.get_connections(user_id)
    
    def create_connection_request(
        self, 
        request_data: NetworkRequestCreate, 
        requester_id: UUID
    ) -> NetworkRequestResponse:
        """Send a connection request to another user."""
        return self.repository.create_request(request_data, requester_id)
    
    def get_pending_requests(self, user_id: UUID) -> List[NetworkRequestResponse]:
        """Get pending connection requests for a user."""
        return self.repository.get_pending_requests(user_id)
    
    def accept_request(self, request_id: UUID, user_id: UUID) -> ConnectionResponse:
        """Accept a connection request."""
        request = self.repository.get_request_by_id(request_id)
        if not request or request.receiver_id != user_id:
            raise ValueError("Request not found or unauthorized")
        return self.repository.accept_request(request)
    
    def reject_request(self, request_id: UUID, user_id: UUID) -> None:
        """Reject a connection request."""
        request = self.repository.get_request_by_id(request_id)
        if not request or request.receiver_id != user_id:
            raise ValueError("Request not found or unauthorized")
        self.repository.reject_request(request)
