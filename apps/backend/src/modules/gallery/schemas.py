"""
Gallery Module - Schemas

Pydantic schemas for gallery item validation.
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime


class GalleryItemBase(BaseModel):
    """Base schema for gallery items."""
    title: Optional[str] = None
    description: Optional[str] = None


class GalleryItemCreate(GalleryItemBase):
    """Schema for creating a gallery item."""
    file_name: str
    file_type: str
    file_size: int


class GalleryItemUpdate(GalleryItemBase):
    """Schema for updating a gallery item."""
    pass


class GalleryItemResponse(GalleryItemBase):
    """Schema for gallery item response."""
    id: UUID
    file_name: str
    file_path: str
    file_type: str
    file_size: int
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
