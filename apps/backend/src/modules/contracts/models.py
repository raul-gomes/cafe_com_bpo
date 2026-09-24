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
    UniqueConstraint,
    func,
)

from src.core.database import Base


class JSONText(TypeDecorator):
    """
    Armazena JSON como TEXT e sempre serializa/desserializa explicitamente.

    Mesma estratégia usada em proposals/models.py: no PostgreSQL o driver
    devolve uma string para colunas TEXT, então o decode é explícito.
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


class ContractTemplate(Base):
    """
    Contrato padrão (modelo) do usuário — único por usuário.

    Serve de base para TODOS os novos contratos: ao gerar um contrato,
    as seções deste modelo são copiadas e os placeholders são substituídos
    pelos dados do prospecto/orçamento.
    """

    __tablename__ = "contract_templates"
    __table_args__ = (UniqueConstraint("user_id", name="uq_contract_templates_user"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    sections = Column(JSONText(), default=list, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Contract(Base):
    """
    Contrato individual, vinculado a um Prospecto (e opcionalmente a um
    Orçamento). As seções são um snapshot já substituído.

    status: 'draft' → 'finalized'. Um contrato finalizado é imutável.
    """

    __tablename__ = "contracts"

    STATUS_DRAFT = "draft"
    STATUS_FINALIZED = "finalized"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    prospect_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prospects.id", ondelete="SET NULL"),
        nullable=True,
    )
    proposal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("pricing_scenarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    client_name = Column(String(255), nullable=False)
    number = Column(Integer, nullable=True)
    sections = Column(JSONText(), default=list, nullable=False)
    template_sections = Column(JSONText(), default=list, nullable=False)
    fields = Column(JSONText(), default=dict, nullable=True)
    status = Column(String(20), default=STATUS_DRAFT, nullable=False)
    finalized_at = Column(DateTime(timezone=True), nullable=True)

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
