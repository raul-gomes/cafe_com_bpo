"""
Gallery Module - Schemas

Pydantic schemas for gallery item validation.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class GalleryItemBase(BaseModel):
    """Base schema for gallery items."""

    title: str | None = None
    description: str | None = None


class GalleryItemCreate(GalleryItemBase):
    """Schema for creating a gallery item."""

    file_name: str
    file_type: str
    file_size: int


class GalleryItemUpdate(GalleryItemBase):
    """Schema for updating a gallery item."""


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


class CommonGalleryItemResponse(BaseModel):
    """Schema for common gallery item response."""

    id: UUID
    file_name: str
    file_type: str
    file_size: int
    title: str | None = None
    description: str | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
