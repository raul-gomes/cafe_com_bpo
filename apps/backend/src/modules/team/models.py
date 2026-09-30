import uuid

from sqlalchemy import (
    UUID,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    func,
)
from sqlalchemy.orm import relationship

from src.core.database import Base


class Role(Base):
    """
    Papel/função que um usuário pode possuir dentro de um time.
    Binário por enquanto (admin | member), extensível no futuro.
    """

    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Team(Base):
    """
    Time vinculado a um cliente (1:1). O time dá o UUID agrupador das
    tarefas do cliente e reúne os membros e convites.
    """

    __tablename__ = "teams"
    __table_args__ = (
        # "Só cliente tem equipe/rotina/SLA/tarefa" garantida pelo banco: a FK
        # composta só casa com companies.type = 'client'.
        CheckConstraint("company_type = 'client'", name="ck_teams_company_type"),
        ForeignKeyConstraint(
            ["company_id", "company_type"],
            ["companies.id", "companies.type"],
            name="fk_teams_company",
            ondelete="NO ACTION",
        ),
        # O time é 1:1 com a empresa, então a unicidade se repete aqui. Declarado
        # como índice nomeado (e não `unique=True` na coluna) porque é assim que a
        # R2 cria: um UNIQUE INDEX chamado `ix_teams_company_id`. Se o model
        # declarasse uma UNIQUE constraint, o autogenerate proporia trocar uma
        # pela outra a cada revisão.
        Index("ix_teams_company_id", "company_id", unique=True),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    # Escrita dupla: `client_id` continua valendo até a release de limpeza, e
    # é daqui que a leitura passa a sair. Nullable nesta fase — vira NOT NULL
    # em R3, depois que o backfill for conferido linha a linha. A unicidade vem
    # do índice `ix_teams_company_id` declarado em `__table_args__`.
    company_id = Column(UUID(as_uuid=True), nullable=True)
    company_type = Column(
        String(20), nullable=False, server_default="client", default="client"
    )
    owner_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
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

    client = relationship("Client", foreign_keys=[client_id])
    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )
    invitations = relationship(
        "TeamInvitation", back_populates="team", cascade="all, delete-orphan"
    )


class TeamMember(Base):
    """
    Membro efetivo de um time. Representa a participação do usuário
    (is_active false = desvinculado).
    """

    __tablename__ = "team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role_id = Column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    team = relationship("Team", back_populates="members")
    member = relationship("User", foreign_keys=[user_id])
    role = relationship("Role", foreign_keys=[role_id])


class TeamInvitation(Base):
    """
    Convite para um colaborador entrar em um time.
    O status declined cobre o caso de rejeição / nova chamada para o mesmo time.
    """

    __tablename__ = "team_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), nullable=False
    )
    invited_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invited_email = Column(String(255), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(
        String(20), nullable=False, server_default="pending"
    )  # pending, accepted, declined, expired
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    team = relationship("Team", back_populates="invitations")
    inviter = relationship("User", foreign_keys=[invited_by])
    routines = relationship(
        "InvitationRoutine",
        back_populates="invitation",
        cascade="all, delete-orphan",
    )


class InvitationRoutine(Base):
    """
    Rotinas liberadas em um convite.
    """

    __tablename__ = "invitation_routines"

    invitation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("team_invitations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="CASCADE"),
        primary_key=True,
    )

    invitation = relationship("TeamInvitation", back_populates="routines")
    template = relationship("ActivityTemplate", foreign_keys=[template_id])
