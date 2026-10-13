from src.core.logger import log

from .repository import BetaSignupRepository
from .schemas import BetaSignupCreate


class BetaSignupService:
    """Business rules of the Beta signup."""

    def __init__(self, repository: BetaSignupRepository):
        """Binds the service to its repository.

        Args:
            repository: Signup repository.
        """
        self.repository = repository

    def register(self, data: BetaSignupCreate) -> None:
        """Stores the signup; a bot (honeypot filled) is silently discarded.

        Args:
            data: Validated signup payload.
        """
        if data.website:
            log.info("Beta signup discarded (honeypot filled)")
            return
        self.repository.upsert(data)
        log.info(f"New Beta signup (profile={data.profile})")
