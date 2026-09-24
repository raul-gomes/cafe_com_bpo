import uuid

from sqlalchemy import UUID, Boolean, Column, DateTime, ForeignKey, String, Text, func

from src.core.database import Base


class Prospect(Base):
    """
    Representa um Prospecto (lead com dados cadastrais apenas) vinculado
    a um Usuário. Diferente do Cliente, um prospecto não possui times,
    rotinas ou SLA — serve como origem de orçamentos e contratos.

    Quando um contrato é finalizado, o prospecto é convertido em Cliente
    (converted_client_id aponta para o registro criado em `clients`).
    """

    __tablename__ = "prospects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    name = Column(String(255), nullable=False)
    cnpj = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    color = Column(String(10), nullable=True)
    description = Column(Text, nullable=True)
    segment = Column(String(100), nullable=True)

    representante_nome = Column(String(255), nullable=True)
    representante_email = Column(String(255), nullable=True)
    representante_cpf = Column(String(20), nullable=True)
    representante_telefone = Column(String(50), nullable=True)
    representante_cargo = Column(String(100), nullable=True)

    street = Column(String(255), nullable=True)
    number = Column(String(20), nullable=True)
    complement = Column(String(255), nullable=True)
    neighborhood = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    cep = Column(String(20), nullable=True)

    converted_client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True
    )
    converted_at = Column(DateTime(timezone=True), nullable=True)

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
