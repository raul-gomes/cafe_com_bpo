from datetime import UTC, datetime

from sqlalchemy.orm import Session

from .models import BetaSignup
from .schemas import BetaSignupCreate


class BetaSignupRepository:
    """Persistence of Beta signups."""

    def __init__(self, session: Session):
        """Binds the repository to a database session.

        Args:
            session: SQLAlchemy session.
        """
        self.session = session

    def upsert(self, data: BetaSignupCreate) -> BetaSignup:
        """Creates the signup, or updates the existing one with the same e-mail.

        Args:
            data: Validated signup payload.

        Returns:
            The stored signup.
        """
        signup = (
            self.session.query(BetaSignup)
            .filter(BetaSignup.email == data.email)
            .one_or_none()
        )
        if signup is None:
            signup = BetaSignup(email=data.email)
            self.session.add(signup)
        signup.name = data.name
        signup.whatsapp = data.whatsapp
        signup.profile = data.profile
        signup.client_range = data.client_range
        signup.challenge = data.challenge or None
        signup.source = data.source or None
        signup.consented_at = datetime.now(UTC)
        self.session.commit()
        return signup

    def list_recent(self, limit: int = 500) -> list[BetaSignup]:
        """Lists the most recent signups first.

        Args:
            limit: Maximum number of rows.

        Returns:
            Signups ordered from newest to oldest.
        """
        return (
            self.session.query(BetaSignup)
            .order_by(BetaSignup.created_at.desc())
            .limit(limit)
            .all()
        )
