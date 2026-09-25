import json
import uuid
from typing import Any

from sqlalchemy import (
    UUID,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    TypeDecorator,
    func,
)

from src.core.database import Base


class JSONText(TypeDecorator):
    """
    Armazena JSON como TEXT e sempre serializa/desserializa explicitamente.

    Necessário porque a migration original criou as colunas como TEXT (não
    JSON/JSONB). No PostgreSQL o driver devolve uma string para colunas TEXT,
    e o tipo JSON() nativo do SQLAlchemy não aplica json.loads nesse caso,
    quebrando a desserialização (500 na listagem/salvamento de propostas).
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return json.dumps(value, ensure_ascii=False, default=str)

    def process_result_value(self, value: Any, dialect) -> Any:
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return value
        return json.loads(value)


class PricingScenario(Base):
    """
    Representa a entidade do Cenário de Precificação.
    """

    __tablename__ = "pricing_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Referência ao tabela users do módulo auth
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    client_name = Column(String(255), nullable=False)
    # Número sequencial do orçamento por BPO (usuário) — ex.: 0001
    number = Column(Integer, nullable=True)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    prospect_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prospects.id", ondelete="SET NULL"),
        nullable=True,
    )
    input_payload = Column(JSONText(), nullable=False)
    result_payload = Column(JSONText(), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, server_default="true", default=True, nullable=False)
    # Compartilhamento público (link de análise do cliente)
    public_hash = Column(String(128), nullable=True)
    public_hash_expires_at = Column(DateTime(timezone=True), nullable=True)
    shared_at = Column(DateTime(timezone=True), nullable=True)
    shared_count = Column(Integer, server_default="0", default=0, nullable=False)
    # Parecer do cliente
    client_decision = Column(String(20), nullable=True)
    client_observation = Column(Text, nullable=True)
    client_decided_at = Column(DateTime(timezone=True), nullable=True)
    decision_history = Column(JSONText(), nullable=True)
