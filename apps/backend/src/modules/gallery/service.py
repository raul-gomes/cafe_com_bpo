"""
Gallery Module - Service Layer

Business logic for gallery/media management.
"""

from typing import List, Optional
from uuid import UUID

from src.modules.gallery.repository import GalleryRepository
from src.modules.gallery.schemas import GalleryItemCreate, GalleryItemUpdate, GalleryItemResponse
from src.modules.auth.schemas import UserResponse


class GalleryService:
    """Service layer for gallery operations."""
    
    def __init__(self, repository: GalleryRepository):
        self.repository = repository
    
    def get_user_items(self, user_id: UUID) -> List[GalleryItemResponse]:
        """Get all gallery items for a user."""
        return self.repository.get_by_user(user_id)
    
    def create_item(
        self, 
        item_data: GalleryItemCreate, 
        user_id: UUID,
        file_url: str
    ) -> GalleryItemResponse:
        """Create a new gallery item with uploaded file."""
        return self.repository.create(item_data, user_id, file_url)
    
    def update_item(
        self,
        item_id: UUID,
        user_id: UUID,
        item_data: GalleryItemUpdate
    ) -> GalleryItemResponse:
        """Update a gallery item."""
        item = self.repository.get_by_id(item_id, user_id)
        if not item:
            raise ValueError(f"Gallery item {item_id} not found")
        return self.repository.update(item, item_data)
    
    def delete_item(self, item_id: UUID, user_id: UUID) -> None:
        """Delete a gallery item."""
        item = self.repository.get_by_id(item_id, user_id)
        if not item:
            raise ValueError(f"Gallery item {item_id} not found")
        self.repository.delete(item)
