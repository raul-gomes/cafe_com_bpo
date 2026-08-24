import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from src.modules.auth.models import User
from src.modules.clients.models import Client
from src.modules.task_manager.models import ActivityTemplate, ClientTemplateAssignment

from .models import (
    InvitationRoutine,
    Role,
    Team,
    TeamInvitation,
    TeamMember,
)

ROLE_ADMIN = "admin"
ROLE_MEMBER = "member"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class TeamRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Roles ──

    def ensure_default_roles(self) -> None:
        """Seed as roles padrão (admin | member) caso não existam."""
        existing = {r.role for r in self.session.query(Role).all()}
        for name in (ROLE_ADMIN, ROLE_MEMBER):
            if name not in existing:
                self.session.add(Role(role=name))
        if not existing or existing != {ROLE_ADMIN, ROLE_MEMBER}:
            self.session.flush()

    def get_role_by_name(self, role: str) -> Role | None:
        return self.session.query(Role).filter(Role.role == role).first()

    # ── Teams ──

    def get_or_create_team(self, client_id: UUID, owner_id: UUID) -> Team:
        """Recupera o time de um cliente, criando-o se não existir (1:1)."""
        team = self.session.query(Team).filter(Team.client_id == client_id).first()
        if not team:
            team = Team(client_id=client_id, owner_id=owner_id)
            self.session.add(team)
            self.session.flush()
        return team

    def get_team_by_client_id(self, client_id: UUID) -> Team | None:
        return self.session.query(Team).filter(Team.client_id == client_id).first()

    def get_team_by_id(self, team_id: UUID) -> Team | None:
        return self.session.query(Team).filter(Team.id == team_id).first()

    def get_client_id_by_team_id(self, team_id: UUID) -> UUID | None:
        team = self.session.query(Team.client_id).filter(Team.id == team_id).first()
        return team[0] if team else None

    def get_team_id_by_client_id(self, client_id: UUID) -> UUID | None:
        team = self.session.query(Team.id).filter(Team.client_id == client_id).first()
        return team[0] if team else None

    # ── Invitations ──

    def create_invitation(
        self,
        team_id: UUID,
        invited_by: UUID,
        invited_email: str,
        template_ids: list[UUID],
    ) -> tuple[TeamInvitation, str]:
        """Create invitation with raw token. Returns (invitation, raw_token)."""
        raw_token = str(uuid.uuid4())
        token_hash = _hash_token(raw_token)

        invitation = TeamInvitation(
            team_id=team_id,
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
                InvitationRoutine(
                    invitation_id=invitation.id,
                    template_id=tid,
                )
            )

        self.session.commit()
        self.session.refresh(invitation)
        return invitation, raw_token

    def get_invitation_by_token(self, raw_token: str) -> TeamInvitation | None:
        token_hash = _hash_token(raw_token)
        return (
            self.session.query(TeamInvitation)
            .filter(
                TeamInvitation.token_hash == token_hash,
                TeamInvitation.status == "pending",
                TeamInvitation.expires_at > datetime.now(timezone.utc),
            )
            .first()
        )

    def get_pending_invitation_by_email(
        self, team_id: UUID, email: str
    ) -> TeamInvitation | None:
        return (
            self.session.query(TeamInvitation)
            .filter(
                TeamInvitation.team_id == team_id,
                TeamInvitation.invited_email == email.lower().strip(),
                TeamInvitation.status == "pending",
            )
            .first()
        )

    def list_invitations(self, team_id: UUID) -> list[TeamInvitation]:
        """Lista os convites de um time, do mais recente para o mais antigo."""
        return (
            self.session.query(TeamInvitation)
            .filter(TeamInvitation.team_id == team_id)
            .order_by(TeamInvitation.created_at.desc())
            .all()
        )

    def get_invitation_by_id(self, invitation_id: UUID) -> TeamInvitation | None:
        return (
            self.session.query(TeamInvitation)
            .filter(TeamInvitation.id == invitation_id)
            .first()
        )

    def cancel_invitation(self, invitation: TeamInvitation) -> None:
        """Remove um convite (gestor cancela o convite enviado).

        As rotinas vinculadas ao convite são removidas por CASCADE.
        """
        self.session.delete(invitation)
        self.session.commit()

    def refresh_invitation(
        self, invitation: TeamInvitation
    ) -> tuple[TeamInvitation, str]:
        """Renova o token de um convite (novo raw token + nova expiração).

        Reabre um convite que expirou ou foi declinado, mantendo status 'pending'.
        Returns (invitation, raw_token).
        """
        raw_token = str(uuid.uuid4())
        invitation.token_hash = _hash_token(raw_token)
        invitation.status = "pending"
        invitation.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        invitation.accepted_at = None
        self.session.commit()
        self.session.refresh(invitation)
        return invitation, raw_token

    def accept_invitation_for_user(
        self, invitation: TeamInvitation, user_id: UUID
    ) -> TeamMember:
        """Accept an invitation and create a team member entry.

        Se já existe um membro ATIVO no mesmo time, não cria duplicata:
        apenas confirma o convite como aceito.
        """
        invitation.status = "accepted"
        invitation.accepted_at = datetime.now(timezone.utc)

        self.ensure_default_roles()
        member_role = self.get_role_by_name(ROLE_MEMBER) or Role(role=ROLE_MEMBER)

        existing = (
            self.session.query(TeamMember.id)
            .filter(
                TeamMember.team_id == invitation.team_id,
                TeamMember.user_id == user_id,
                TeamMember.is_active,
            )
            .first()
        )
        if existing:
            self.session.commit()
            return TeamMember(
                id=existing[0], team_id=invitation.team_id, user_id=user_id
            )

        member = TeamMember(
            team_id=invitation.team_id,
            user_id=user_id,
            role_id=member_role.id,
            is_active=True,
        )
        self.session.add(member)
        self.session.commit()
        self.session.refresh(member)
        return member

    def decline_invitation(self, invitation: TeamInvitation) -> None:
        """Mark an invitation as declined (recusado pelo convidado)."""
        invitation.status = "declined"
        self.session.commit()

    # ── Team Members ──

    def get_team_members(self, client_id: UUID) -> list[TeamMember]:
        """Members ativos de um time (resolvido pelo client_id do time)."""
        team = self.get_team_by_client_id(client_id)
        if not team:
            return []
        return (
            self.session.query(TeamMember)
            .filter(TeamMember.team_id == team.id, TeamMember.is_active)
            .all()
        )

    def is_team_member(self, client_id: UUID, user_id: UUID) -> bool:
        """Verifica se o usuário é membro ativo do time deste cliente."""
        team = self.get_team_by_client_id(client_id)
        if not team:
            return False
        return (
            self.session.query(TeamMember.id)
            .filter(
                TeamMember.team_id == team.id,
                TeamMember.user_id == user_id,
                TeamMember.is_active,
            )
            .first()
            is not None
        )

    def get_member_role(self, client_id: UUID, user_id: UUID) -> str | None:
        """Retorna a role ('admin' | 'member') do usuário no time do cliente."""
        team = self.get_team_by_client_id(client_id)
        if not team:
            return None
        result = (
            self.session.query(Role.role)
            .join(TeamMember, TeamMember.role_id == Role.id)
            .filter(
                TeamMember.team_id == team.id,
                TeamMember.user_id == user_id,
                TeamMember.is_active,
            )
            .first()
        )
        return result[0] if result else None

    def get_team_client_ids(self, user_id: UUID) -> list[UUID]:
        """Return all client IDs where the user is an active team member."""
        results = (
            self.session.query(Team.client_id)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .filter(TeamMember.user_id == user_id, TeamMember.is_active)
            .all()
        )
        return [r[0] for r in results]

    def remove_member(self, team_id: UUID, user_id: UUID) -> bool:
        """Desvincula o membro do time e revoga acesso a rotinas."""
        member = (
            self.session.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                TeamMember.is_active,
            )
            .first()
        )
        if not member:
            return False
        member.is_active = False

        # Revogar convite aceito para limpar acesso a rotinas
        user = self.get_user_by_id(user_id)
        if user:
            invitation = (
                self.session.query(TeamInvitation)
                .filter(
                    TeamInvitation.team_id == team_id,
                    TeamInvitation.invited_email == user.email,
                    TeamInvitation.status == "accepted",
                )
                .first()
            )
            if invitation:
                invitation.status = "declined"

        self.session.commit()
        return True

    def get_inactive_member(self, team_id: UUID, user_id: UUID) -> TeamMember | None:
        return (
            self.session.query(TeamMember)
            .filter(
                TeamMember.team_id == team_id,
                TeamMember.user_id == user_id,
                ~TeamMember.is_active,
            )
            .first()
        )

    def reactivate_member(self, team_id: UUID, user_id: UUID) -> TeamMember:
        """Reativa um membro desvinculado do time e restaura acesso a rotinas."""
        member = self.get_inactive_member(team_id, user_id)
        if not member:
            raise ValueError("Membro não encontrado para reativação")
        member.is_active = True

        # Restaurar convite para restaurar acesso a rotinas
        user = self.get_user_by_id(user_id)
        if user:
            invitation = (
                self.session.query(TeamInvitation)
                .filter(
                    TeamInvitation.team_id == team_id,
                    TeamInvitation.invited_email == user.email,
                    TeamInvitation.status == "declined",
                )
                .first()
            )
            if invitation:
                invitation.status = "accepted"

        self.session.commit()
        self.session.refresh(member)
        return member

    def get_role_name_by_id(self, role_id: UUID) -> str | None:
        role = self.session.query(Role.role).filter(Role.id == role_id).first()
        return role[0] if role else None

    # ── Routines for a member ──

    def get_routines_for_invitation(
        self, invitation_id: UUID
    ) -> list[InvitationRoutine]:
        return (
            self.session.query(InvitationRoutine)
            .filter(InvitationRoutine.invitation_id == invitation_id)
            .all()
        )

    def get_accepted_invitation_for_user(
        self, client_id: UUID, user_id: UUID
    ) -> TeamInvitation | None:
        """Retorna o convite aceito do usuário para o time do cliente (se houver)."""
        team = self.get_team_by_client_id(client_id)
        if not team:
            return None
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        return (
            self.session.query(TeamInvitation)
            .filter(
                TeamInvitation.team_id == team.id,
                TeamInvitation.invited_email == user.email,
                TeamInvitation.status == "accepted",
            )
            .first()
        )

    def remove_routine_from_invitation(
        self, invitation_id: UUID, template_id: UUID
    ) -> int:
        """Remove o acesso a uma rotina de um convite (idempotente)."""
        deleted = (
            self.session.query(InvitationRoutine)
            .filter(
                InvitationRoutine.invitation_id == invitation_id,
                InvitationRoutine.template_id == template_id,
            )
            .delete(synchronize_session=False)
        )
        self.session.commit()
        return deleted

    def add_routine_to_invitation(self, invitation_id: UUID, template_id: UUID) -> bool:
        """Concede o acesso a uma rotina em um convite (idempotente).

        Returns True se criou o acesso, False se o membro já possuía.
        """
        existing = (
            self.session.query(InvitationRoutine.template_id)
            .filter(
                InvitationRoutine.invitation_id == invitation_id,
                InvitationRoutine.template_id == template_id,
            )
            .first()
        )
        if existing:
            return False
        self.session.add(
            InvitationRoutine(
                invitation_id=invitation_id,
                template_id=template_id,
            )
        )
        self.session.commit()
        return True

    def remove_template_access_from_team(
        self, client_id: UUID, template_id: UUID
    ) -> int:
        """Remove o acesso de TODOS os convites do time do cliente a uma rotina.

        Usado quando a rotina é desvinculada do cliente: a equipe e os
        colaboradores perdem o acesso ao template.
        """
        team = self.get_team_by_client_id(client_id)
        if not team:
            return 0
        invitation_ids = [
            row[0]
            for row in self.session.query(TeamInvitation.id)
            .filter(TeamInvitation.team_id == team.id)
            .all()
        ]
        if not invitation_ids:
            return 0
        deleted = (
            self.session.query(InvitationRoutine)
            .filter(
                InvitationRoutine.template_id == template_id,
                InvitationRoutine.invitation_id.in_(invitation_ids),
            )
            .delete(synchronize_session=False)
        )
        self.session.commit()
        return deleted

    def get_routines_for_member(
        self, client_id: UUID, user_id: UUID
    ) -> list[ActivityTemplate]:
        """Get all active templates that a member has access to for a client.

        Filters by ClientTemplateAssignment.is_active when an assignment exists.
        Routines without any assignment are included (granted directly).
        """
        invitation = self.get_accepted_invitation_for_user(client_id, user_id)
        if not invitation:
            return []

        routines = (
            self.session.query(InvitationRoutine)
            .filter(InvitationRoutine.invitation_id == invitation.id)
            .all()
        )
        template_ids = [r.template_id for r in routines]
        if not template_ids:
            return []

        template_id_set = set(template_ids)
        all_assignments = self.session.query(ClientTemplateAssignment).all()
        assignment_map = {
            a.template_id: a
            for a in all_assignments
            if a.client_id == client_id and a.template_id in template_id_set
        }

        active_ids = set()
        for tid in template_id_set:
            assignment = assignment_map.get(tid)
            if assignment is None or assignment.is_active:
                active_ids.add(tid)

        if not active_ids:
            return []

        return (
            self.session.query(ActivityTemplate)
            .filter(ActivityTemplate.id.in_(list(active_ids)))
            .all()
        )

    def restore_template_access_to_team(
        self, client_id: UUID, template_id: UUID
    ) -> int:
        """Restaura acesso de todos os convites aceitos do time a uma rotina.

        Usado quando o vínculo é reativado.
        """
        team = self.get_team_by_client_id(client_id)
        if not team:
            return 0
        accepted_invitations = [
            inv.id
            for inv in self.session.query(TeamInvitation)
            .filter(
                TeamInvitation.team_id == team.id,
                TeamInvitation.status == "accepted",
            )
            .all()
        ]
        if not accepted_invitations:
            return 0
        already_granted = {
            row[0]
            for row in self.session.query(InvitationRoutine.invitation_id)
            .filter(
                InvitationRoutine.template_id == template_id,
                InvitationRoutine.invitation_id.in_(accepted_invitations),
            )
            .all()
        }
        count = 0
        for inv_id in accepted_invitations:
            if inv_id not in already_granted:
                self.session.add(
                    InvitationRoutine(invitation_id=inv_id, template_id=template_id)
                )
                count += 1
        self.session.commit()
        return count

    # ── Helpers ──

    def get_client_owner_id(self, client_id: UUID) -> UUID | None:
        client = (
            self.session.query(Client.user_id)
            .filter(Client.id == client_id, Client.is_active)
            .first()
        )
        return client[0] if client else None

    def get_client_by_id(self, client_id: UUID) -> Client | None:
        return (
            self.session.query(Client)
            .filter(Client.id == client_id, Client.is_active)
            .first()
        )

    def get_user_by_email(self, email: str) -> User | None:
        return (
            self.session.query(User).filter(User.email == email.lower().strip()).first()
        )

    def get_user_by_id(self, user_id: UUID) -> User | None:
        return self.session.query(User).filter(User.id == user_id).first()

    def get_template_by_id(self, template_id: UUID) -> ActivityTemplate | None:
        return (
            self.session.query(ActivityTemplate)
            .filter(ActivityTemplate.id == template_id)
            .first()
        )
