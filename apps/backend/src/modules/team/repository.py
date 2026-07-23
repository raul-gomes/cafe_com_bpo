import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from .models import ClientInvitation, ClientInvitationRoutine, ClientTeamMember
from src.modules.clients.models import Client
from src.modules.tasks.models import ActivityTemplate
from src.modules.auth.models import User


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class TeamRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Invitations ──

    def create_invitation(
        self,
        client_id: UUID,
        invited_by: UUID,
        invited_email: str,
        template_ids: list[UUID],
    ) -> tuple[ClientInvitation, str]:
        """Create invitation with raw token. Returns (invitation, raw_token)."""
        raw_token = str(uuid.uuid4())
        token_hash = _hash_token(raw_token)

        invitation = ClientInvitation(
            client_id=client_id,
            invited_by=invited_by,
            invited_email=invited_email.lower().strip(),
            token_hash=token_hash,
            status="pending",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        self.session.add(invitation)
        self.session.flush()

        for tid in template_ids:
            self.session.add(
                ClientInvitationRoutine(
                    invitation_id=invitation.id,
                    template_id=tid,
                )
            )

        self.session.commit()
        self.session.refresh(invitation)
        return invitation, raw_token

    def get_invitation_by_token(self, raw_token: str) -> Optional[ClientInvitation]:
        token_hash = _hash_token(raw_token)
        return (
            self.session.query(ClientInvitation)
            .filter(
                ClientInvitation.token_hash == token_hash,
                ClientInvitation.status == "pending",
                ClientInvitation.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )

    def get_pending_invitation_by_email(
        self, client_id: UUID, email: str
    ) -> Optional[ClientInvitation]:
        return (
            self.session.query(ClientInvitation)
            .filter(
                ClientInvitation.client_id == client_id,
                ClientInvitation.invited_email == email.lower().strip(),
                ClientInvitation.status == "pending",
            )
            .first()
        )

    def accept_invitation_for_user(
        self, invitation: ClientInvitation, user_id: UUID
    ) -> ClientTeamMember:
        """Accept an invitation and create a team member entry."""
        invitation.status = "accepted"
        invitation.accepted_at = datetime.now(timezone.utc)

        member = ClientTeamMember(
            client_id=invitation.client_id,
            user_id=user_id,
            invited_by=invitation.invited_by,
        )
        self.session.add(member)
        self.session.commit()
        self.session.refresh(member)
        return member

    # ── Team Members ──

    def get_team_members(self, client_id: UUID) -> list[ClientTeamMember]:
        return (
            self.session.query(ClientTeamMember)
            .filter(ClientTeamMember.client_id == client_id)
            .all()
        )

    def is_team_member(self, client_id: UUID, user_id: UUID) -> bool:
        return (
            self.session.query(ClientTeamMember.id)
            .filter(
                ClientTeamMember.client_id == client_id,
                ClientTeamMember.user_id == user_id,
            )
            .first()
            is not None
        )

    def get_team_client_ids(self, user_id: UUID) -> list[UUID]:
        """Return all client IDs where the user is a team member."""
        results = (
            self.session.query(ClientTeamMember.client_id)
            .filter(ClientTeamMember.user_id == user_id)
            .all()
        )
        return [r[0] for r in results]

    def remove_member(self, client_id: UUID, user_id: UUID) -> bool:
        member = (
            self.session.query(ClientTeamMember)
            .filter(
                ClientTeamMember.client_id == client_id,
                ClientTeamMember.user_id == user_id,
            )
            .first()
        )
        if not member:
            return False
        self.session.delete(member)
        self.session.commit()
        return True

    # ── Routines for a member ──

    def get_routines_for_invitation(
        self, invitation_id: UUID
    ) -> list[ClientInvitationRoutine]:
        return (
            self.session.query(ClientInvitationRoutine)
            .filter(ClientInvitationRoutine.invitation_id == invitation_id)
            .all()
        )

    def get_routines_for_member(
        self, client_id: UUID, user_id: UUID
    ) -> list[ActivityTemplate]:
        """Get all templates that a member has access to for a client."""
        # Find the accepted invitation for this user+client
        user = self.get_user_by_id(user_id)
        if not user:
            return []
        invitation = (
            self.session.query(ClientInvitation)
            .filter(
                ClientInvitation.client_id == client_id,
                ClientInvitation.invited_email == user.email,
                ClientInvitation.status == "accepted",
            )
            .first()
        )
        if not invitation:
            return []

        routines = (
            self.session.query(ClientInvitationRoutine)
            .filter(ClientInvitationRoutine.invitation_id == invitation.id)
            .all()
        )
        template_ids = [r.template_id for r in routines]
        if not template_ids:
            return []

        return (
            self.session.query(ActivityTemplate)
            .filter(ActivityTemplate.id.in_(template_ids))
            .all()
        )

    # ── Helpers ──

    def get_client_owner_id(self, client_id: UUID) -> Optional[UUID]:
        client = (
            self.session.query(Client.user_id)
            .filter(Client.id == client_id, Client.is_active)
            .first()
        )
        return client[0] if client else None

    def get_client_by_id(self, client_id: UUID) -> Optional[Client]:
        return (
            self.session.query(Client)
            .filter(Client.id == client_id, Client.is_active)
            .first()
        )

    def get_user_by_email(self, email: str) -> Optional[User]:
        return (
            self.session.query(User).filter(User.email == email.lower().strip()).first()
        )

    def get_user_by_id(self, user_id: UUID) -> Optional[User]:
        return self.session.query(User).filter(User.id == user_id).first()

    def get_template_by_id(self, template_id: UUID) -> Optional[ActivityTemplate]:
        return (
            self.session.query(ActivityTemplate)
            .filter(ActivityTemplate.id == template_id)
            .first()
        )
