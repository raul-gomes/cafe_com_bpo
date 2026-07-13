import uuid
from sqlalchemy import Column, String, DateTime, func, ForeignKey, UUID
from sqlalchemy.orm import relationship
from src.core.database import Base


class ClientInvitation(Base):
    """
    Convite para um colaborador acessar as rotinas de um cliente.
    """

    __tablename__ = "client_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    invited_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invited_email = Column(String(255), nullable=False)
    token_hash = Column(String(255), unique=True, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, accepted, expired
    expires_at = Column(DateTime(timezone=True), nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", foreign_keys=[client_id])
    inviter = relationship("User", foreign_keys=[invited_by])
    routines = relationship(
        "ClientInvitationRoutine",
        back_populates="invitation",
        cascade="all, delete-orphan",
    )


class ClientInvitationRoutine(Base):
    """
    Rotinas liberadas em um convite.
    """

    __tablename__ = "client_invitation_routines"

    invitation_id = Column(
        UUID(as_uuid=True),
        ForeignKey("client_invitations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("activity_templates.id", ondelete="CASCADE"),
        primary_key=True,
    )

    invitation = relationship("ClientInvitation", back_populates="routines")
    template = relationship("ActivityTemplate", foreign_keys=[template_id])


class ClientTeamMember(Base):
    """
    Membro efetivo do time de um cliente.
    """

    __tablename__ = "client_team_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invited_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    client = relationship("Client", foreign_keys=[client_id])
    member = relationship("User", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[invited_by])
