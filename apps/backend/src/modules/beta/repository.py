from datetime import UTC, datetime

from sqlalchemy.orm import Session

from .models import BetaSignup
from .schemas import BetaSignupCreate


class BetaSignupRepository:
    def __init__(self, session: Session):
        self.session = session

    def upsert(self, data: BetaSignupCreate) -> BetaSignup:
        """Cria a inscrição ou atualiza a existente com o mesmo e-mail."""
        signup = (
            self.session.query(BetaSignup)
            .filter(BetaSignup.email == data.email)
            .one_or_none()
        )
        if signup is None:
            signup = BetaSignup(email=data.email)
            self.session.add(signup)
        signup.nome = data.nome
        signup.whatsapp = data.whatsapp
        signup.perfil = data.perfil
        signup.faixa_clientes = data.faixa_clientes
        signup.desafio = data.desafio or None
        signup.origem = data.origem or None
        signup.consentimento_em = datetime.now(UTC)
        self.session.commit()
        return signup

    def list_recent(self, limit: int = 500) -> list[BetaSignup]:
        return (
            self.session.query(BetaSignup)
            .order_by(BetaSignup.created_at.desc())
            .limit(limit)
            .all()
        )
