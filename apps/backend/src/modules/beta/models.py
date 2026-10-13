import uuid
from datetime import UTC, datetime

from sqlalchemy import UUID, Column, DateTime, String, Text, func

from src.core.database import Base


def _now() -> datetime:
    """Current instant in UTC, with microseconds (keeps close signups ordered).

    Returns:
        The current UTC datetime.
    """
    return datetime.now(UTC)


class BetaSignup(Base):
    """A person who wants to be a Beta tester (landing page signup).

    Not a platform user: it is the waiting list the team reads to invite Betas.
    One row per e-mail (stored lowercase); signing up again with the same
    e-mail updates the row.
    """

    __tablename__ = "beta_signups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    whatsapp = Column(String(20), nullable=True)
    # starting | growing | accounting_office | other
    profile = Column(String(30), nullable=False)
    # 0 | 1-5 | 6-15 | 16-30 | 30+
    client_range = Column(String(10), nullable=False)
    challenge = Column(Text, nullable=True)
    # Page or campaign the signup came from (e.g. "home"), to measure acquisition.
    source = Column(String(100), nullable=True)
    consented_at = Column(DateTime(timezone=True), nullable=False)

    created_at = Column(
        DateTime(timezone=True), default=_now, server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=_now,
        server_default=func.now(),
        onupdate=_now,
        nullable=False,
    )
