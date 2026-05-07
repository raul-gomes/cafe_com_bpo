"""
Gallery Module - Repository Layer

Data access for gallery items.
"""

from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.gallery.models import GalleryItem


class GalleryRepository:
    """Repository for gallery item operations."""
    
    def __init__(self, session: Session):
        self.session = session
    
    def create(
        self, 
        item_data: dict, 
        user_id: UUID, 
        file_url: str
    ) -> GalleryItem:
        """Create a new gallery item."""
        item = GalleryItem(
            user_id=user_id,
            file_name=item_data.get("file_name"),
            file_path=file_url,
            file_type=item_data.get("file_type"),
            file_size=item_data.get("file_size"),
            title=item_data.get("title"),
            description=item_data.get("description")
        )
        self.session.add(item)
        self.session.commit()
        self.session.refresh(item)
        return item
    
    def get_by_id(self, item_id: UUID, user_id: UUID) -> Optional[GalleryItem]:
        """Get a gallery item by ID for a specific user."""
        return self.session.query(GalleryItem).filter(
            GalleryItem.id == item_id,
            GalleryItem.user_id == user_id
        ).first()
    
    def get_by_user(self, user_id: UUID) -> List[GalleryItem]:
        """Get all gallery items for a user."""
        return self.session.query(GalleryItem).filter(
            GalleryItem.user_id == user_id
        ).order_by(GalleryItem.created_at.desc()).all()
    
    def update(self, item: GalleryItem, update_data: dict) -> GalleryItem:
        """Update a gallery item."""
        for key, value in update_data.items():
            if hasattr(item, key) and key not in ['file_path', 'file_name', 'file_type', 'file_size']:
                setattr(item, key, value)
        self.session.commit()
        self.session.refresh(item)
        return item
    
    def delete(self, item: GalleryItem) -> None:
        """Delete a gallery item."""
        self.session.delete(item)
        self.session.commit()
