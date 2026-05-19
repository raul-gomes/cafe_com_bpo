"""
Gallery Module - Models

Database models for gallery/media items.
"""

from sqlalchemy import (
    Column,
    String,
    Text,
    DateTime,
    ForeignKey,
    Integer,
    func as sa_func,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from uuid import uuid4

from src.core.database import Base


class GalleryItem(Base):
    """Gallery media items uploaded by users."""

    __tablename__ = "gallery_items"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)

    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=sa_func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=sa_func.now(), onupdate=sa_func.now()
    )

    user = relationship("User", back_populates="gallery_items")


class CommonGalleryItem(Base):
    """Arquivos comunitários visíveis para todos os usuários."""

    __tablename__ = "common_gallery_items"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)
    file_size = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = Column(DateTime(timezone=True), server_default=sa_func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=sa_func.now(), onupdate=sa_func.now()
    )

    uploader = relationship("User", foreign_keys=[created_by])
