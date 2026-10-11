from src.core.logger import log

from .repository import BetaSignupRepository
from .schemas import BetaSignupCreate


class BetaSignupService:
    def __init__(self, repository: BetaSignupRepository):
        self.repository = repository

    def register(self, data: BetaSignupCreate) -> None:
        """Grava a inscrição; robô (campo-armadilha preenchido) é descartado."""
        if data.website:
            log.info("🪤 Inscrição beta descartada (campo-armadilha preenchido)")
            return
        self.repository.upsert(data)
        log.info(f"☕ Nova inscrição beta (perfil={data.perfil})")
