import uuid
from datetime import UTC, datetime

from sqlalchemy import UUID, Column, DateTime, String, Text, func

from src.core.database import Base


def _now() -> datetime:
    return datetime.now(UTC)


class BetaSignup(Base):
    """Inscrição de quem quer ser Beta (captação da página inicial).

    Não é usuário do sistema: é a lista de interessados que o time usa para
    convidar Betas. Um registro por e-mail (normalizado em minúsculas); uma
    nova inscrição com o mesmo e-mail atualiza os dados.
    """

    __tablename__ = "beta_signups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome = Column(String(120), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    whatsapp = Column(String(20), nullable=True)
    # comecando | crescendo | escritorio_contabil | outro
    perfil = Column(String(30), nullable=False)
    # 0 | 1-5 | 6-15 | 16-30 | 30+
    faixa_clientes = Column(String(10), nullable=False)
    desafio = Column(Text, nullable=True)
    # Página/campanha de origem (ex.: "home"), para medir a captação.
    origem = Column(String(100), nullable=True)
    consentimento_em = Column(DateTime(timezone=True), nullable=False)

    # Default no Python (microssegundos) mantém a ordem estável entre inscrições próximas.
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
