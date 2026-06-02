from sqlalchemy import Column, String, DateTime, func, ForeignKey, UUID, Text
from src.core.database import Base
import uuid


class UserGoogleToken(Base):
    """
    Stores Google OAuth2 tokens for Calendar API access.

    Each user has exactly one token record (unique constraint on user_id).
    Tokens are used to authenticate Google Calendar API requests.
    """

    __tablename__ = "user_google_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=False)
    token_type = Column(String(50), nullable=False, default="Bearer")
    expires_at = Column(DateTime(timezone=True), nullable=False)
    scope = Column(String(500), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
