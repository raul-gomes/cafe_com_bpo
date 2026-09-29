import uuid

from sqlalchemy import (
    UUID,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)

from src.core.database import Base

# Discriminador do ciclo de vida da empresa. São dois valores fixos, então um
# VARCHAR com CHECK serve e evita divergência entre Postgres e SQLite.
COMPANY_TYPE_PROSPECT = "prospect"
COMPANY_TYPE_CLIENT = "client"


class Company(Base):
    """Empresa do BPO — a unificação de `clients` e `prospects`.

    Uma linha por empresa, nos dois estágios do ciclo de vida:

    - `type='prospect'`: empresa em prospecção. **Não** tem equipe, rotina, SLA
      nem tarefa — a garantia é do banco (FK composta em quem exige cliente).
    - `type='client'`: empresa atendida.

    A conversão **não cria uma segunda linha**: o `type` da própria linha muda
    para `client` e o `converted_at` é preenchido. É o que mantém o vínculo de
    quem já tem tarefa/time/contrato apontado para o `id` (que é o do cliente).
    """

    __tablename__ = "companies"
    __table_args__ = (
        # Habilita a FK composta que garante "só cliente tem equipe/rotina".
        UniqueConstraint("id", "type", name="uq_companies_id_type"),
        CheckConstraint("type IN ('prospect', 'client')", name="ck_companies_type"),
        Index("ix_companies_user_type", "user_id", "type", "is_active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type = Column(String(20), nullable=False)

    name = Column(String(255), nullable=False)
    cnpj = Column(String(50), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    color = Column(String(10), nullable=True)
    description = Column(Text, nullable=True)
    segment = Column(String(100), nullable=True)

    street = Column(String(255), nullable=True)
    number = Column(String(20), nullable=True)
    complement = Column(String(255), nullable=True)
    neighborhood = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    cep = Column(String(20), nullable=True)

    # Ciclo de vida
    converted_at = Column(DateTime(timezone=True), nullable=True)
    reproved_at = Column(DateTime(timezone=True), nullable=True)

    # `use_alter` porque `contacts.company_id` aponta de volta para cá: sem isso
    # o create_all do SQLite (que não faz ALTER ADD CONSTRAINT) trava.
    primary_contact_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL", use_alter=True),
        nullable=True,
    )

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
