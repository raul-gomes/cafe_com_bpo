from sqlalchemy import Column, String, DateTime, func, UUID, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from src.core.database import Base
import uuid

class UserFile(Base):
    """
    Representa metadados de um arquivo armazenado (ex: OneDrive).
    """
    __tablename__ = "user_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    category = Column(String(50), nullable=False) # avatar, document, image
    provider = Column(String(50), default="onedrive", nullable=False)
    provider_item_id = Column(String(255), nullable=True)
    status = Column(String(50), default="pending", nullable=False) # pending, active, failed, deleted
    read_url = Column(String(1000), nullable=True)
    mime_type = Column(String(100), nullable=False)
    size_bytes = Column(BigInteger, nullable=False)
    original_file_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    owner = relationship("User", back_populates="files", foreign_keys=[user_id])

class User(Base):
    """
    Representa a entidade de um Usuário no banco de dados.
    """
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(150), nullable=True)
    company = Column(String(150), nullable=True)
    avatar_url = Column(String(500), nullable=True) # Legado: será substituído gradualmente por avatar_file
    avatar_file_id = Column(UUID(as_uuid=True), ForeignKey("user_files.id"), nullable=True)
    auth_provider = Column(String(50), default="local", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    files = relationship("UserFile", back_populates="owner", foreign_keys=[UserFile.user_id])
    avatar_file = relationship("UserFile", foreign_keys=[avatar_file_id])
