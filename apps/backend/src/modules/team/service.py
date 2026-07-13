from uuid import UUID
from typing import Optional
from src.core.logger import log
from src.core.email import EmailService
from src.core.config import get_settings

from .repository import TeamRepository
from .schemas import (
    InviteCreate, InviteResponse, TeamMemberResponse,
    RoutineAccess, TeamListResponse, AcceptResponse,
)


settings = get_settings()


class TeamService:
    def __init__(self, repository: TeamRepository):
        self.repo = repository

    def invite_collaborator(
        self, client_id: UUID, data: InviteCreate, invited_by: UUID
    ) -> InviteResponse:
        """Send an invitation to a collaborator."""
        # Verify client exists and belongs to inviter
        client = self.repo.get_client_by_id(client_id)
        if not client:
            raise ValueError("Cliente não encontrado")
        if client.user_id != invited_by:
            raise ValueError("Apenas o gestor do cliente pode convidar")

        # Verify templates exist
        for tid in data.template_ids:
            tmpl = self.repo.get_template_by_id(tid)
            if not tmpl:
                raise ValueError(f"Template {tid} não encontrado")

        # Check for existing pending invitation
        existing = self.repo.get_pending_invitation_by_email(client_id, data.email)
        if existing:
            raise ValueError("Já existe um convite pendente para este email neste cliente")

        # Check if user is already a team member
        user = self.repo.get_user_by_email(data.email)
        if user and self.repo.is_team_member(client_id, user.id):
            raise ValueError("Este usuário já é membro da equipe deste cliente")

        # Create invitation
        invitation, raw_token = self.repo.create_invitation(
            client_id=client_id,
            invited_by=invited_by,
            invited_email=data.email,
            template_ids=data.template_ids,
        )

        # Send email
        self._send_invite_email(
            to_email=data.email,
            client_name=client.name,
            inviter_name=self.repo.get_user_by_id(invited_by).name or "Um usuário",
            token=raw_token,
            user_exists=user is not None,
        )

        return InviteResponse(invitation_id=invitation.id, status="pending")

    def accept_invitation(self, token: str, user_id: Optional[UUID] = None) -> AcceptResponse:
        """Accept an invitation. If user_id is None, return info for redirect."""
        invitation = self.repo.get_invitation_by_token(token)
        if not invitation:
            raise ValueError("Convite inválido ou expirado")

        if user_id is None:
            # User not logged in — return info for redirect
            client = self.repo.get_client_by_id(invitation.client_id)
            return AcceptResponse(
                status="redirect",
                client_name=client.name if client else None,
            )

        # Verify the user's email matches the invitation
        user = self.repo.get_user_by_id(user_id)
        if not user or user.email.lower().strip() != invitation.invited_email.lower().strip():
            raise ValueError("Este email não corresponde ao convite")

        # Accept
        member = self.repo.accept_invitation_for_user(invitation, user_id)
        client = self.repo.get_client_by_id(member.client_id)

        log.info(f"👥 Colaborador {user.email} aceitou convite para cliente {client.name}")

        return AcceptResponse(
            status="accepted",
            client_name=client.name if client else None,
            client_id=member.client_id,
        )

    def get_team_members(self, client_id: UUID, current_user_id: UUID) -> TeamListResponse:
        """List team members for a client."""
        client = self.repo.get_client_by_id(client_id)
        if not client:
            raise ValueError("Cliente não encontrado")

        # Only owner and members can view
        if client.user_id != current_user_id and not self.repo.is_team_member(client_id, current_user_id):
            raise ValueError("Acesso negado")

        members_raw = self.repo.get_team_members(client_id)
        members = []
        for m in members_raw:
            user = self.repo.get_user_by_id(m.user_id)
            routines = self.repo.get_routines_for_member(client_id, m.user_id)
            members.append(TeamMemberResponse(
                user_id=m.user_id,
                name=user.name if user else None,
                email=user.email if user else "",
                joined_at=m.joined_at,
                routines=[RoutineAccess(template_id=r.id, name=r.name) for r in routines],
            ))

        return TeamListResponse(members=members)

    def remove_member(self, client_id: UUID, user_id: UUID, current_user_id: UUID) -> None:
        """Remove a team member."""
        client = self.repo.get_client_by_id(client_id)
        if not client:
            raise ValueError("Cliente não encontrado")
        if client.user_id != current_user_id:
            raise ValueError("Apenas o gestor pode remover membros")
        if user_id == current_user_id:
            raise ValueError("Você não pode remover a si mesmo")

        if not self.repo.remove_member(client_id, user_id):
            raise ValueError("Membro não encontrado")

    def _send_invite_email(
        self, to_email: str, client_name: str, inviter_name: str, token: str, user_exists: bool
    ) -> None:
        """Send invitation email."""
        if user_exists:
            accept_url = f"{settings.frontend_url}/invitations/accept?token={token}"
        else:
            accept_url = f"{settings.frontend_url}/cadastro?invite_token={token}"

        subject = f"Convite para equipe — {client_name}"

        html = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f7; color: #1d1d1f;">
            <div style="background: white; border-radius: 12px; padding: 40px; text-align: center;">
                <h1 style="font-size: 24px; margin-bottom: 8px;">Café com BPO</h1>
                <h2 style="font-size: 18px; font-weight: 400; color: #555; margin-bottom: 24px;">Convite para Equipe</h2>

                <p style="font-size: 16px; color: #333; line-height: 1.6;">
                    O(A) <strong>{inviter_name}</strong> convidou você para fazer parte da equipe de
                    <strong>{client_name}</strong> no Café com BPO.
                </p>

                <a href="{accept_url}"
                   style="display: inline-block; background-color: #0071e3; color: white;
                          padding: 14px 32px; border-radius: 8px; text-decoration: none;
                          font-size: 16px; font-weight: 500; margin: 24px 0;">
                    Aceitar Convite
                </a>

                <p style="font-size: 14px; color: #888; margin-top: 32px;">
                    Se você não conhece o remetente, ignore este e-mail.<br>
                    Este link expira em 7 dias.
                </p>
            </div>
        </body>
        </html>
        """

        text = f"""
        Café com BPO - Convite para Equipe

        O(A) {inviter_name} convidou você para fazer parte da equipe de {client_name}.

        Acesse o link abaixo para aceitar:
        {accept_url}

        Se você não conhece o remetente, ignore este e-mail.
        Este link expira em 7 dias.
        """

        EmailService.send_email(to_email, subject, text, html)
        log.info(f"📧 Convite enviado para {to_email} — cliente {client_name}")
