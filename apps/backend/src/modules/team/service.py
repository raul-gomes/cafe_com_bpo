from datetime import datetime, timezone
from uuid import UUID

from src.core.config import get_settings
from src.core.email import EmailService
from src.core.logger import log
from src.modules.companies.models import Company
from src.modules.companies.repository import CompanyRepository

from .models import TeamInvitation
from .repository import TeamRepository
from .schemas import (
    AcceptResponse,
    InvitationListResponse,
    InvitationResponse,
    InviteBatchResponse,
    InviteCreate,
    InviteResult,
    RoutineAccess,
    TeamListResponse,
    TeamMemberResponse,
)

settings = get_settings()


class TeamService:
    def __init__(self, repository: TeamRepository, companies: CompanyRepository):
        """Monta o serviço com o repositório do time e a facade de empresas.

        `companies` é a `CompanyRepository` — a fonte única do vínculo e da
        posse (Fase 3, item 5). A checagem de posse mora aqui, e não no router:
        o id da rota é do cliente, mas quem responde "este é o seu cliente" é a
        empresa, não a linha legada.
        """
        self.repo = repository
        self.companies = companies

    def _company(self, client_id: UUID) -> Company | None:
        """Empresa (estágio `client`) por trás do id da rota, ou `None`.

        Time, rotina, SLA e tarefa só existem para cliente — a garantia é do
        banco (FK composta). Esta leitura carrega a mesma premissa para o
        serviço, que responde "não encontrado" em vez de montar payload para uma
        empresa em prospecção.
        """
        return self.companies.get_client_by_id(client_id)

    def invite_collaborator(
        self, client_id: UUID, data: InviteCreate, invited_by: UUID
    ) -> InviteBatchResponse:
        """Send invitations to multiple collaborators."""
        # Verify client exists and belongs to inviter
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != invited_by:
            raise ValueError("Apenas o gestor do cliente pode convidar")

        # Verify templates exist
        for tid in data.template_ids:
            tmpl = self.repo.get_template_by_id(tid)
            if not tmpl:
                raise ValueError(f"Template {tid} não encontrado")

        if not data.emails:
            raise ValueError("Pelo menos um email deve ser informado")

        # Garante time do cliente + roles seedadas
        self.repo.ensure_default_roles()
        team = self.repo.get_or_create_team(client_id, invited_by)

        results: list[InviteResult] = []

        for email in data.emails:
            email_clean = email.lower().strip()
            result = self._invite_single(
                team.id,
                client_id,
                email_clean,
                data.template_ids,
                invited_by,
                company.name,
            )
            results.append(result)

        total_sent = sum(1 for r in results if r.status == "sent")
        total_errors = sum(1 for r in results if r.status == "error")

        return InviteBatchResponse(
            results=results,
            total_sent=total_sent,
            total_errors=total_errors,
        )

    def _invite_single(
        self,
        team_id: UUID,
        client_id: UUID,
        email: str,
        template_ids: list[UUID],
        invited_by: UUID,
        client_name: str,
    ) -> InviteResult:
        """Process a single email invitation."""
        try:
            # Check for existing pending invitation
            existing = self.repo.get_pending_invitation_by_email(team_id, email)
            if existing:
                return InviteResult(
                    email=email,
                    status="error",
                    error="Já existe um convite pendente para este email neste cliente",
                )

            # Check if user is already a team member
            user = self.repo.get_user_by_email(email)
            if user and self.repo.is_team_member(client_id, user.id):
                return InviteResult(
                    email=email,
                    status="error",
                    error="Este usuário já é membro da equipe deste cliente",
                )

            # Create invitation
            invitation, raw_token = self.repo.create_invitation(
                team_id=team_id,
                invited_by=invited_by,
                invited_email=email,
                template_ids=template_ids,
            )

            # Send email
            self._send_invite_email(
                to_email=email,
                client_name=client_name,
                inviter_name=self.repo.get_user_by_id(invited_by).name or "Um usuário",
                token=raw_token,
                user_exists=user is not None,
            )

            return InviteResult(
                email=email,
                status="sent",
                invitation_id=invitation.id,
            )

        except Exception as e:
            log.error(f"Erro ao convidar {email}: {e!s}")
            return InviteResult(
                email=email,
                status="error",
                error=str(e),
            )

    def accept_invitation(
        self, token: str, user_id: UUID | None = None
    ) -> AcceptResponse:
        """Accept an invitation. If user_id is None, return info for redirect."""
        invitation = self.repo.get_invitation_by_token(token)
        if not invitation:
            raise ValueError("Convite inválido ou expirado")

        client_id = self.repo.get_client_id_by_team_id(invitation.team_id)
        company = self._company(client_id) if client_id else None

        if user_id is None:
            # User not logged in — return info for redirect
            return AcceptResponse(
                status="redirect",
                client_name=company.name if company else None,
            )

        # Verify the user's email matches the invitation
        user = self.repo.get_user_by_id(user_id)
        if (
            not user
            or user.email.lower().strip() != invitation.invited_email.lower().strip()
        ):
            raise ValueError(
                f"Este convite foi enviado para {invitation.invited_email}. "
                "Faça login com essa conta para aceitar."
            )

        # Se o usuário já foi membro deste time e foi desvinculado,
        # reativa a participação em vez de duplicar. Em qualquer caso o
        # convite é marcado como aceito para não duplicar na listagem.
        invitation.status = "accepted"
        invitation.accepted_at = datetime.now(timezone.utc)
        if self._get_inactive_member(invitation.team_id, user_id):
            self.repo.reactivate_member(invitation.team_id, user_id)
        else:
            self.repo.accept_invitation_for_user(invitation, user_id)

        log.info(
            f"👥 Colaborador {user.email} aceitou convite para cliente "
            f"{company.name if company else client_id}"
        )

        return AcceptResponse(
            status="accepted",
            client_name=company.name if company else None,
            client_id=client_id,
        )

    def _get_inactive_member(self, team_id: UUID, user_id: UUID):
        return self.repo.get_inactive_member(team_id, user_id)

    def accept_invitation_by_id(
        self, invitation_id: UUID, user_id: UUID
    ) -> AcceptResponse:
        """Accept a pending invitation for the logged-in user."""
        invitation = self.repo.get_invitation_by_id(invitation_id)
        if not invitation or invitation.status != "pending":
            raise ValueError("Convite inválido ou não está mais pendente")
        expires_at = invitation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise ValueError("Este convite expirou")

        user = self.repo.get_user_by_id(user_id)
        if (
            not user
            or user.email.lower().strip() != invitation.invited_email.lower().strip()
        ):
            raise ValueError(
                f"Este convite foi enviado para {invitation.invited_email}. "
                "Faça login com essa conta para aceitar."
            )

        client_id = self.repo.get_client_id_by_team_id(invitation.team_id)
        # Sempre marca o convite como aceito (inclusive na reativação de um
        # ex-membro) para não aparecer duplicado na listagem de convites.
        invitation.status = "accepted"
        invitation.accepted_at = datetime.now(timezone.utc)
        if self._get_inactive_member(invitation.team_id, user_id):
            self.repo.reactivate_member(invitation.team_id, user_id)
        else:
            self.repo.accept_invitation_for_user(invitation, user_id)

        company = self._company(client_id) if client_id else None
        log.info(
            f"👥 Colaborador {user.email} aceitou convite para cliente "
            f"{company.name if company else client_id}"
        )
        return AcceptResponse(
            status="accepted",
            client_name=company.name if company else None,
            client_id=client_id,
        )

    def decline_invitation_by_id(self, invitation_id: UUID, user_id: UUID) -> None:
        """Decline a pending invitation for the logged-in user."""
        invitation = self.repo.get_invitation_by_id(invitation_id)
        if not invitation or invitation.status != "pending":
            raise ValueError("Convite inválido ou não está mais pendente")

        user = self.repo.get_user_by_id(user_id)
        if (
            not user
            or user.email.lower().strip() != invitation.invited_email.lower().strip()
        ):
            raise ValueError("Você não pode recusar este convite")

        self.repo.decline_invitation(invitation)
        log.info(f"🙅 {user.email} recusou um convite para equipe")

    def get_team_members(
        self, client_id: UUID, current_user_id: UUID
    ) -> TeamListResponse:
        """List team members for a client."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")

        # Only owner and members can view
        if company.user_id != current_user_id and not self.repo.is_team_member(
            client_id, current_user_id
        ):
            raise ValueError("Acesso negado")

        team = self.repo.get_team_by_client_id(client_id)
        if not team:
            return TeamListResponse(members=[])

        return TeamListResponse(members=self._build_members(team.id, client_id))

    def _build_members(
        self, team_id: UUID, client_id: UUID
    ) -> list[TeamMemberResponse]:
        """Monta os cards de membro com um número **fixo** de consultas.

        O caminho antigo fazia, por membro: 1 query do usuário, 1 da role, 1 do
        time, 1 do convite aceito, 1 das rotinas do convite, 1 de **toda** a
        tabela de vínculos de rotina e 1 dos templates — 8 por linha, 24 numa
        equipe de 3. Aqui são 4 no total, independentemente do tamanho da equipe:

        1. membros + usuário + role (um join);
        2. convites aceitos do time (o e-mail é a chave que liga ao membro);
        3. rotinas de todos esses convites, com o nome (um join);
        4. estado dos vínculos dessas rotinas no cliente.
        """
        rows = self.repo.get_members_with_identity(team_id)
        if not rows:
            return []

        accepted = self.repo.get_accepted_invitations_by_email(team_id)
        routines_by_invitation = self.repo.get_routine_names_by_invitation_ids(
            [invitation.id for invitation in accepted.values()]
        )
        template_ids = sorted(
            {
                template_id
                for routines in routines_by_invitation.values()
                for template_id in routines
            },
            key=str,
        )
        visible = self.repo.get_active_template_ids_for_client(client_id, template_ids)

        members: list[TeamMemberResponse] = []
        for member, name, email, _role in rows:
            invitation = accepted.get((email or "").lower().strip())
            granted = (
                routines_by_invitation.get(invitation.id, {}) if invitation else {}
            )
            members.append(
                TeamMemberResponse(
                    user_id=member.user_id,
                    name=name,
                    email=email or "",
                    routines=[
                        RoutineAccess(template_id=template_id, name=routine_name)
                        for template_id, routine_name in granted.items()
                        if template_id in visible
                    ],
                )
            )
        return members

    def list_invitations(
        self, client_id: UUID, current_user_id: UUID
    ) -> InvitationListResponse:
        """Lista os convites do cliente (pendente, aceito, declinado, expirado)."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != current_user_id:
            raise ValueError("Acesso negado")

        team = self.repo.get_team_by_client_id(client_id)
        if not team:
            return InvitationListResponse(invitations=[])

        return InvitationListResponse(
            invitations=[
                self._to_invitation_response(invitation)
                for invitation in self.repo.list_invitations(team.id)
            ]
        )

    def _to_invitation_response(self, invitation: TeamInvitation) -> InvitationResponse:
        """DTO do convite: identidade, status e as duas datas que o card mostra.

        `routines` e `created_at` saíram daqui: o card de "Convites enviados"
        mostra email, status e expiração, e as rotinas eram montadas com duas
        queries por rotina (`get_template_by_id` chamado duas vezes no mesmo
        comprehension) para não aparecer em lugar nenhum (regra §6).
        """
        return InvitationResponse(
            invitation_id=invitation.id,
            email=invitation.invited_email,
            status=invitation.status,
            expires_at=invitation.expires_at,
            accepted_at=invitation.accepted_at,
        )

    def resend_invitation(
        self, client_id: UUID, invitation_id: UUID, current_user_id: UUID
    ) -> InvitationResponse:
        """Reenvia o email de um convite, renovando o token e a expiração."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != current_user_id:
            raise ValueError("Acesso negado")

        team = self.repo.get_team_by_client_id(client_id)
        if not team:
            raise ValueError("Time não encontrado para este cliente")

        invitation = self.repo.get_invitation_by_id(invitation_id)
        if not invitation or invitation.team_id != team.id:
            raise ValueError("Convite não encontrado")

        if invitation.status == "accepted":
            raise ValueError("Este convite já foi aceito")

        inviter = self.repo.get_user_by_id(invitation.invited_by)
        inviter_name = inviter.name if inviter else "Um usuário"
        user_exists = self.repo.get_user_by_email(invitation.invited_email) is not None

        invitation, raw_token = self.repo.refresh_invitation(invitation)
        self._send_invite_email(
            to_email=invitation.invited_email,
            client_name=company.name,
            inviter_name=inviter_name,
            token=raw_token,
            user_exists=user_exists,
        )

        return self._to_invitation_response(invitation)

    def cancel_invitation(
        self, client_id: UUID, invitation_id: UUID, current_user_id: UUID
    ) -> None:
        """Cancela (remove) um convite enviado pelo gestor."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != current_user_id:
            raise ValueError("Acesso negado")

        team = self.repo.get_team_by_client_id(client_id)
        if not team:
            raise ValueError("Time não encontrado para este cliente")

        invitation = self.repo.get_invitation_by_id(invitation_id)
        if not invitation or invitation.team_id != team.id:
            raise ValueError("Convite não encontrado")

        if invitation.status == "accepted":
            raise ValueError("Este convite já foi aceito; remova o membro da equipe")

        self.repo.cancel_invitation(invitation)
        log.info(
            f"🚫 Convite {invitation_id} cancelado para {invitation.invited_email} "
            f"na empresa {client_id}"
        )

    def remove_member(
        self, client_id: UUID, user_id: UUID, current_user_id: UUID
    ) -> None:
        """Remove a team member."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != current_user_id:
            raise ValueError("Apenas o gestor pode remover membros")
        if user_id == current_user_id:
            raise ValueError("Você não pode remover a si mesmo")

        team = self.repo.get_or_create_team(client_id, company.user_id)
        if not self.repo.remove_member(team.id, user_id):
            raise ValueError("Membro não encontrado")

    def revoke_routine_from_member(
        self,
        client_id: UUID,
        user_id: UUID,
        template_id: UUID,
        current_user_id: UUID,
    ) -> None:
        """Remove o acesso de um membro a uma rotina do cliente."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != current_user_id:
            raise ValueError("Apenas o gestor pode revogar o acesso a rotinas")

        invitation = self.repo.get_accepted_invitation_for_user(client_id, user_id)
        if not invitation:
            raise ValueError("Membro não encontrado")

        tmpl = self.repo.get_template_by_id(template_id)
        if not tmpl:
            raise ValueError("Rotina não encontrada")

        deleted = self.repo.remove_routine_from_invitation(invitation.id, template_id)
        if deleted == 0:
            raise ValueError("O membro não possui acesso a esta rotina")
        log.info(
            f"🔓 Acesso do membro {user_id} à rotina {template_id} revogado "
            f"no cliente {client_id}"
        )

    def grant_routine_to_member(
        self,
        client_id: UUID,
        user_id: UUID,
        template_id: UUID,
        current_user_id: UUID,
    ) -> None:
        """Concede o acesso de um membro a uma rotina do cliente."""
        company = self._company(client_id)
        if not company:
            raise ValueError("Cliente não encontrado")
        if company.user_id != current_user_id:
            raise ValueError("Apenas o gestor pode conceder o acesso a rotinas")

        invitation = self.repo.get_accepted_invitation_for_user(client_id, user_id)
        if not invitation:
            raise ValueError("Membro não encontrado")

        tmpl = self.repo.get_template_by_id(template_id)
        if not tmpl:
            raise ValueError("Rotina não encontrada")

        if self.repo.add_routine_to_invitation(invitation.id, template_id):
            log.info(
                f"🔒 Acesso do membro {user_id} à rotina {template_id} concedido "
                f"no cliente {client_id}"
            )

    def _send_invite_email(
        self,
        to_email: str,
        client_name: str,
        inviter_name: str,
        token: str,
        user_exists: bool,
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
