import uuid

from sqlalchemy import (
    UUID,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)

from src.core.database import Base


class Contact(Base):
    """Contato livre cadastrado pelo BPO (nome, telefone, e-mail, empresa).

    NÃO duplica o contato do cliente: o contato que veio do cadastro de clientes
    é lido de `prospects.representante_*` (ver `ContactRepository`), então esta
    tabela guarda apenas o que o BPO cadastrou por conta própria.
    """

    __tablename__ = "contacts"
    __table_args__ = (Index("ix_contacts_user_active", "user_id", "is_active"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    nome = Column(String(255), nullable=False)
    telefone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    empresa = Column(String(255), nullable=True)

    # Vínculo com a empresa (1:N). Vem do `prospects.representante_*` hoje e
    # passa a ser a única fonte de pessoa: N contatos por empresa, um deles
    # apontado por `companies.primary_contact_id`.
    # Regra §16: nada de hard delete — o contato da empresa é desativado em
    # cascata (`is_active = false`), nunca apagado.
    company_id = Column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="NO ACTION"),
        nullable=True,
    )
    cpf = Column(String(20), nullable=True)
    cargo = Column(String(100), nullable=True)

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
