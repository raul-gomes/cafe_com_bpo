import re
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

import bleach
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Session

from src.modules.auth.models import User

from .models import (
    Conversation,
    ConversationMessage,
    ConversationParticipant,
    DiscussionComment,
    DiscussionPost,
    ProfileComment,
    Project,
    ProjectApplication,
    ProjectGroup,
    ProjectGroupMember,
    ProjectGroupPost,
    ProjectInvitation,
    ProjectSkill,
    Skill,
    UserSkill,
)
from .schemas import (
    CommentCreate,
    GroupPostCreate,
    MessageCreate,
    PostCreate,
    ProfileCommentCreate,
    ProjectApplicationCreate,
    ProjectCreate,
    ProjectInviteCreate,
    ProjectUpdate,
)

# Allowlist de tags/atributos aceitos no fórum (bleach). Qualquer tag/atributo
# fora da lista é removido, junto com atributos style (vetor de CSS injection)
# e links com protocolos perigosos (javascript:, data:, vbscript:).
BLEACH_ALLOWED_TAGS = {
    "p",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "mark",
    "small",
    "sub",
    "sup",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
    "code",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "hr",
}
BLEACH_ALLOWED_ATTRS = {"a": ["href", "title", "rel"]}
BLEACH_ALLOWED_PROTOCOLS = {"http", "https", "mailto"}


def _like(term: str) -> str:
    """Termo de busca com os curingas do LIKE escapados (100% não vira "tudo")."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def sanitize_html(html_str: str) -> str:
    if not html_str:
        return html_str
    return bleach.clean(
        html_str,
        tags=BLEACH_ALLOWED_TAGS,
        attributes=BLEACH_ALLOWED_ATTRS,
        protocols=BLEACH_ALLOWED_PROTOCOLS,
        strip=True,
    )


def plain_text(html_str: str) -> str:
    """Texto puro de um conteúdo rico.

    Notificações são texto simples (aparecem no sino e nas sinalizações da
    Comunidade), então nunca devem carregar o HTML do comentário.
    """
    if not html_str:
        return ""
    return bleach.clean(html_str, tags=set(), attributes={}, strip=True).strip()


def snippet(text: str, limit: int = 160) -> str:
    """Texto curto para notificações, sem cortar no meio de uma palavra."""
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.strip().lower())
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text[:120]


class NetworkRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_post(self, author_id: UUID, post_data: PostCreate) -> DiscussionPost:
        safe_msg = sanitize_html(post_data.message)
        post = DiscussionPost(
            author_id=author_id,
            title=post_data.title,
            message=safe_msg,
            tags=post_data.tags,
        )
        self.session.add(post)
        self.session.commit()
        self.session.refresh(post)
        return post

    def get_posts(self, limit: int = 10, offset: int = 0):
        # Only active posts
        query = self.session.query(DiscussionPost).filter(DiscussionPost.is_active)
        total = query.count()
        items = (
            query.order_by(desc(DiscussionPost.created_at))
            .offset(offset)
            .limit(limit)
            .all()
        )
        return items, total

    def get_post_by_id(self, post_id: UUID) -> DiscussionPost | None:
        return (
            self.session.query(DiscussionPost)
            .filter(DiscussionPost.id == post_id, DiscussionPost.is_active)
            .first()
        )

    def delete_post(self, post_id: UUID, user_id: UUID):
        post = self.get_post_by_id(post_id)
        if not post:
            raise ValueError("Post not found")
        if post.author_id != user_id:
            raise ValueError("Action Denied: You cannot delete someone else's post.")
        if post.comments_count > 0:
            raise ValueError("Cannot delete post with active comments")

        # Soft delete
        post.is_active = False
        post.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def create_comment(
        self, post_id: UUID, author_id: UUID, comment_data: CommentCreate
    ) -> DiscussionComment:
        post = self.get_post_by_id(post_id)
        if not post:
            raise ValueError("Post not found")

        safe_msg = sanitize_html(comment_data.message)
        comment = DiscussionComment(
            post_id=post_id, author_id=author_id, message=safe_msg
        )
        self.session.add(comment)

        # Increment comment count
        post.comments_count += 1

        # Trigger notification if commenter is not author
        if post.author_id != author_id:
            from src.modules.notifications.repository import NotificationRepository
            from src.modules.notifications.service import NotificationDispatcher

            self.session.flush()
            NotificationDispatcher(NotificationRepository(self.session)).dispatch(
                user_id=post.author_id,
                title="Novo comentário no seu tópico",
                message=snippet(plain_text(comment.message)),
                notif_type="post_commented",
                related_entity_type="discussion_post",
                related_entity_id=post_id,
                triggered_by_user_id=author_id,
            )

        self.session.commit()
        self.session.refresh(comment)
        return comment

    def get_comments(self, post_id: UUID):
        query = self.session.query(DiscussionComment).filter(
            DiscussionComment.post_id == post_id, DiscussionComment.is_active
        )
        return query.order_by(DiscussionComment.created_at).all()

    def get_comment_by_id(self, comment_id: UUID) -> DiscussionComment | None:
        return (
            self.session.query(DiscussionComment)
            .filter(
                DiscussionComment.id == comment_id,
                DiscussionComment.is_active,
            )
            .first()
        )

    def delete_comment(self, comment_id: UUID, user_id: UUID):
        comment = self.get_comment_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        if comment.author_id != user_id:
            raise ValueError("Action Denied: You cannot delete someone else's comment.")

        # Soft delete
        comment.is_active = False
        comment.deleted_at = datetime.now(timezone.utc)

        # Decrement post comment count
        post = comment.post
        if post and post.comments_count > 0:
            post.comments_count -= 1

        self.session.commit()

    # ── Skills ──────────────────────────────────────────────

    def search_skills(self, query: str = "", limit: int = 10) -> list[Skill]:
        q = self.session.query(Skill).filter(Skill.is_active)
        q = q.order_by(Skill.name)
        if query.strip():
            pattern = f"%{query.strip().lower()}%"
            q = q.filter(
                func.lower(Skill.name).like(pattern)
                | func.lower(Skill.slug).like(pattern)
            )
        return q.limit(limit).all()

    def get_skill_by_name(self, name: str) -> Skill | None:
        return (
            self.session.query(Skill)
            .filter(func.lower(Skill.name) == name.strip().lower())
            .first()
        )

    def get_skill_by_id(self, skill_id: UUID) -> Skill | None:
        return self.session.query(Skill).get(skill_id)

    def create_skill(self, name: str) -> Skill:
        existing = self.get_skill_by_name(name)
        if existing:
            return existing
        skill = Skill(name=name.strip(), slug=slugify(name))
        self.session.add(skill)
        self.session.flush()
        return skill

    def get_user_skills(self, user_id: UUID) -> list[Skill]:
        return (
            self.session.query(Skill)
            .join(UserSkill, UserSkill.skill_id == Skill.id)
            .filter(UserSkill.user_id == user_id, Skill.is_active)
            .order_by(Skill.name)
            .all()
        )

    def add_user_skill(self, user_id: UUID, name: str) -> Skill:
        skill = self.create_skill(name)
        linked = (
            self.session.query(UserSkill)
            .filter(UserSkill.user_id == user_id, UserSkill.skill_id == skill.id)
            .first()
        )
        if linked:
            return skill
        self.session.add(UserSkill(user_id=user_id, skill_id=skill.id))
        self.session.commit()
        self.session.refresh(skill)
        return skill

    def remove_user_skill(self, user_id: UUID, skill_id: UUID) -> None:
        link = (
            self.session.query(UserSkill)
            .filter(UserSkill.user_id == user_id, UserSkill.skill_id == skill_id)
            .first()
        )
        if not link:
            raise ValueError("Skill not found in user profile")
        self.session.delete(link)
        self.session.commit()

    # ── Projects ─────────────────────────────────────────

    @staticmethod
    def _dedupe_skill_names(skills: list[str]) -> list[str]:
        seen: set[str] = set()
        result = []
        for name in skills:
            cleaned = name.strip()
            key = cleaned.lower()
            if cleaned and key not in seen:
                seen.add(key)
                result.append(cleaned)
        return result

    def create_project(self, owner_id: UUID, data: ProjectCreate) -> Project:
        project = Project(
            owner_id=owner_id,
            title=data.title.strip(),
            description=sanitize_html(data.description).strip(),
            status="open",
            team_size=data.team_size,
            remote_type=data.remote_type,
            published_at=datetime.now(timezone.utc),
        )
        self.session.add(project)
        self.session.flush()
        if data.skills:
            for name in self._dedupe_skill_names(data.skills):
                skill = self.create_skill(name)
                self.session.add(ProjectSkill(project_id=project.id, skill_id=skill.id))
        if data.invites:
            invite_emails = {
                i.invited_user_id for i in data.invites if i.message.strip()
            }
            if owner_id in invite_emails:
                raise ValueError("You cannot invite yourself")
            existing = (
                self.session.query(User.id).filter(User.id.in_(invite_emails)).all()
            )
            found = {u.id for u in existing}
            missing = invite_emails - found
            if missing:
                raise ValueError("User not found")
            for inv in data.invites:
                if not inv.message.strip():
                    continue
                invitation = ProjectInvitation(
                    project_id=project.id,
                    invited_user_id=inv.invited_user_id,
                    message=sanitize_html(inv.message).strip(),
                )
                self.session.add(invitation)
                self.session.flush()
                self._ensure_conversation(invitation, invitation.message)
        self._ensure_group(project)
        self.session.commit()
        self.session.refresh(project)
        return project

    def get_projects(
        self,
        limit: int = 10,
        offset: int = 0,
        query: str = "",
        skills: list[str] | None = None,
        status: str | None = None,
        remote_type: str | None = None,
    ):
        q = self.session.query(Project).filter(Project.is_active)
        if query.strip():
            # curinga do LIKE escapado: digitar "%" no campo de busca do mural
            # não pode devolver o mural inteiro
            term = f"%{_like(query.strip())}%"
            q = q.filter(
                or_(
                    Project.title.ilike(term, escape="\\"),
                    Project.description.ilike(term, escape="\\"),
                )
            )
        if status:
            q = q.filter(Project.status == status)
        if remote_type:
            q = q.filter(Project.remote_type == remote_type)
        if skills and any(s.strip() for s in skills):
            names = {s.strip().lower() for s in skills if s.strip()}
            subq = (
                self.session.query(ProjectSkill.project_id)
                .join(Skill, Skill.id == ProjectSkill.skill_id)
                .filter(func.lower(Skill.name).in_(names), Skill.is_active)
                .group_by(ProjectSkill.project_id)
                .having(func.count(func.distinct(Skill.id)) >= len(names))
                .subquery()
            )
            q = q.join(subq, subq.c.project_id == Project.id)
        total = q.count()
        items = q.order_by(desc(Project.created_at)).offset(offset).limit(limit).all()
        return items, total

    def get_my_projects(self, user_id: UUID, query: str = "") -> list[Project]:
        """Projetos do usuário: os que ele **criou** + os que ele **participa**.

        Participar = estar na equipe do tópico (`project_group_members`), o que
        só acontece com convite aceito (regra do mural). Convidado com convite
        pendente ou recusado não entra. Um projeto pode ser dos dois jeitos (dono
        que também é membro), então o filtro é um OR e cada projeto volta uma
        linha só.
        """
        # subquery dos projetos em que o usuário é membro (tópico não arquivado)
        participation = (
            self.session.query(ProjectGroup.project_id.label("project_id"))
            .join(ProjectGroupMember, ProjectGroupMember.group_id == ProjectGroup.id)
            .filter(
                ProjectGroupMember.user_id == user_id,
                ProjectGroup.is_active,
            )
            .subquery()
        )
        q = (
            self.session.query(Project)
            .outerjoin(participation, participation.c.project_id == Project.id)
            .filter(
                Project.is_active,
                or_(
                    Project.owner_id == user_id,
                    participation.c.project_id.isnot(None),
                ),
            )
        )
        if query.strip():
            term = f"%{_like(query.strip())}%"
            q = q.filter(
                or_(
                    Project.title.ilike(term, escape="\\"),
                    Project.description.ilike(term, escape="\\"),
                )
            )
        return q.order_by(
            desc(Project.updated_at), desc(Project.created_at), desc(Project.id)
        ).all()

    def get_project_by_id(self, project_id: UUID) -> Project | None:
        return (
            self.session.query(Project)
            .filter(Project.id == project_id, Project.is_active)
            .first()
        )

    def update_project(
        self, project_id: UUID, owner_id: UUID, data: ProjectUpdate
    ) -> Project:
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != owner_id:
            raise ValueError("Action Denied: You cannot edit someone else's project.")

        if data.title is not None:
            project.title = data.title.strip()
        if data.description is not None:
            project.description = sanitize_html(data.description).strip()
        if data.team_size is not None:
            project.team_size = data.team_size
        if data.remote_type is not None:
            project.remote_type = data.remote_type
        if data.skills is not None:
            desired = self._dedupe_skill_names(data.skills)
            desired_lower = {d.lower() for d in desired}
            existing = {ps.skill.name.lower(): ps for ps in project.skills}
            for lower, link in existing.items():
                if lower not in desired_lower:
                    self.session.delete(link)
            for name in desired:
                if name.lower() not in existing:
                    skill = self.create_skill(name)
                    self.session.add(
                        ProjectSkill(project_id=project.id, skill_id=skill.id)
                    )
        self.session.commit()
        self.session.refresh(project)
        return project

    def delete_project(self, project_id: UUID, owner_id: UUID) -> None:
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != owner_id:
            raise ValueError("Action Denied: You cannot delete someone else's project.")

        project.is_active = False
        project.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    # ── Search professionals ─────────────────────────────

    def search_professionals(
        self,
        skill_names: list[str],
        mode: str = "any",
        exclude_user_id: UUID | None = None,
        limit: int = 50,
    ) -> list[User]:
        names = {s.strip().lower() for s in skill_names if s.strip()}
        if not names:
            return []
        q = (
            self.session.query(User)
            .join(UserSkill, UserSkill.user_id == User.id)
            .join(Skill, Skill.id == UserSkill.skill_id)
            .filter(Skill.is_active, func.lower(Skill.name).in_(names))
        )
        if exclude_user_id is not None:
            q = q.filter(User.id != exclude_user_id)
        if mode == "all":
            q = q.group_by(User.id).having(
                func.count(func.distinct(Skill.id)) >= len(names)
            )
        else:
            q = q.distinct()
        users = q.limit(limit).all()
        users.sort(key=lambda u: (u.name or "").lower())
        return users

    # ── Invitations ───────────────────────────────────────

    def create_invitation(
        self, project_id: UUID, owner_id: UUID, data: ProjectInviteCreate
    ) -> ProjectInvitation:
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != owner_id:
            raise ValueError(
                "Action Denied: You cannot invite on someone else's project."
            )
        if data.invited_user_id == owner_id:
            raise ValueError("You cannot invite yourself")
        invitee = self.session.get(User, data.invited_user_id)
        if not invitee:
            raise ValueError("User not found")

        self._ensure_group(project)

        existing = (
            self.session.query(ProjectInvitation)
            .filter(
                ProjectInvitation.project_id == project_id,
                ProjectInvitation.invited_user_id == data.invited_user_id,
            )
            .first()
        )
        if existing:
            if existing.status == "accepted":
                raise ValueError(
                    "This candidate already accepted an invitation for this project"
                )
            existing.status = "pending"
            existing.message = data.message.strip()
            existing.responded_at = None
            self.session.flush()
            self._ensure_conversation(existing, existing.message)
            self.session.commit()
            self.session.refresh(existing)
            return existing

        invitation = ProjectInvitation(
            project_id=project_id,
            invited_user_id=data.invited_user_id,
            message=data.message.strip(),
        )
        self.session.add(invitation)
        self.session.flush()
        self._ensure_conversation(invitation, invitation.message)
        self.session.commit()
        self.session.refresh(invitation)
        return invitation

    def get_invitation_by_id(self, invitation_id: UUID) -> ProjectInvitation | None:
        return (
            self.session.query(ProjectInvitation)
            .filter(ProjectInvitation.id == invitation_id)
            .first()
        )

    def get_project_invitations(self, project_id: UUID, viewer_id: UUID) -> list:
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != viewer_id:
            raise ValueError(
                "Action Denied: You cannot see invites of someone else's project."
            )
        return (
            self.session.query(ProjectInvitation)
            .filter(ProjectInvitation.project_id == project_id)
            .order_by(desc(ProjectInvitation.created_at))
            .all()
        )

    def get_my_invitations(self, user_id: UUID) -> list:
        return (
            self.session.query(ProjectInvitation)
            .filter(ProjectInvitation.invited_user_id == user_id)
            .order_by(desc(ProjectInvitation.created_at))
            .all()
        )

    def respond_invitation(
        self, invitation_id: UUID, user_id: UUID, accept: bool
    ) -> ProjectInvitation:
        invitation = self.get_invitation_by_id(invitation_id)
        if not invitation:
            raise ValueError("Invitation not found")
        if invitation.invited_user_id != user_id:
            raise ValueError(
                "Action Denied: You cannot respond to someone else's invite."
            )
        if invitation.status != "pending":
            raise ValueError("Invitation already responded")

        if accept:
            invitation.status = "accepted"
            group = self._ensure_group(invitation.project)
            self._ensure_group_member(group.id, invitation.invited_user_id)
        else:
            invitation.status = "declined"

        invitation.responded_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(invitation)
        return invitation

    # ── Applications (propostas de candidatos) ────────────

    def apply_to_project(
        self, project_id: UUID, applicant_id: UUID, data: ProjectApplicationCreate
    ) -> ProjectApplication:
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id == applicant_id:
            raise ValueError("You cannot apply to your own project")
        if project.applications_closed:
            raise ValueError("Project is closed for new applications")

        existing = (
            self.session.query(ProjectApplication)
            .filter(
                ProjectApplication.project_id == project_id,
                ProjectApplication.applicant_id == applicant_id,
            )
            .first()
        )
        if existing:
            raise ValueError("You already applied to this project")

        application = ProjectApplication(
            project_id=project_id,
            applicant_id=applicant_id,
            message=sanitize_html(data.message).strip(),
        )
        self.session.add(application)
        self.session.flush()

        self._dispatch_application_notification(project, application)
        self.session.commit()
        self.session.refresh(application)
        return application

    def has_user_applied(self, project_id: UUID, applicant_id: UUID) -> bool:
        return self.get_user_application_status(project_id, applicant_id) is not None

    def get_user_application_status(
        self, project_id: UUID, applicant_id: UUID
    ) -> str | None:
        if applicant_id is None:
            return None
        application = (
            self.session.query(ProjectApplication)
            .filter(
                ProjectApplication.project_id == project_id,
                ProjectApplication.applicant_id == applicant_id,
            )
            .first()
        )
        return application.status if application else None

    def get_application_by_id(self, application_id: UUID):
        return self.session.query(ProjectApplication).get(application_id)

    def list_project_applications(self, project_id: UUID, viewer_id: UUID):
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != viewer_id:
            raise ValueError(
                "Action Denied: You cannot see applications of someone else's project."
            )
        return (
            self.session.query(ProjectApplication)
            .filter(ProjectApplication.project_id == project_id)
            .order_by(desc(ProjectApplication.created_at))
            .all()
        )

    def count_project_applications(self, project_id: UUID) -> int:
        return (
            self.session.query(ProjectApplication)
            .filter(
                ProjectApplication.project_id == project_id,
                ProjectApplication.status == "pending",
            )
            .count()
        )

    def list_my_applications(self, applicant_id: UUID):
        return (
            self.session.query(ProjectApplication)
            .filter(ProjectApplication.applicant_id == applicant_id)
            .order_by(desc(ProjectApplication.created_at))
            .all()
        )

    def respond_application(
        self, application_id: UUID, project_owner_id: UUID, accept: bool
    ) -> ProjectApplication:
        application = self.get_application_by_id(application_id)
        if not application:
            raise ValueError("Application not found")
        project = self.get_project_by_id(application.project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != project_owner_id:
            raise ValueError(
                "Action Denied: Only the project owner can respond to applications."
            )
        if application.status != "pending":
            raise ValueError("Application already responded")

        if accept:
            application.status = "accepted"
            group = self._ensure_group(project)
            self._ensure_group_member(group.id, application.applicant_id)
            conversation = self._create_application_conversation(project, application)
            self._dispatch_application_accepted_notification(
                project, application, conversation
            )
        else:
            application.status = "declined"

        application.responded_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(application)
        return application

    def toggle_project_applications(self, project_id: UUID, owner_id: UUID) -> Project:
        project = self.get_project_by_id(project_id)
        if not project:
            raise ValueError("Project not found")
        if project.owner_id != owner_id:
            raise ValueError("Action Denied: You cannot change someone else's project.")
        project.applications_closed = not project.applications_closed
        self.session.commit()
        self.session.refresh(project)
        return project

    def _create_application_conversation(
        self, project: Project, application: ProjectApplication
    ) -> Conversation:
        existing = self.get_conversation_by_application_id(application.id)
        if existing:
            return existing
        conversation = Conversation(application_id=application.id)
        self.session.add(conversation)
        self.session.flush()
        self.session.add(
            ConversationParticipant(
                conversation_id=conversation.id, user_id=project.owner_id
            )
        )
        self.session.add(
            ConversationParticipant(
                conversation_id=conversation.id, user_id=application.applicant_id
            )
        )
        self.session.add(
            ConversationMessage(
                conversation_id=conversation.id,
                sender_id=application.applicant_id,
                body=f"Proposta: {application.message}",
            )
        )
        self.session.flush()
        return conversation

    def _dispatch_application_notification(
        self, project: Project, application: ProjectApplication
    ) -> None:
        from src.modules.notifications.repository import NotificationRepository
        from src.modules.notifications.service import NotificationDispatcher

        self.session.flush()
        applicant = self.get_user_by_id(application.applicant_id)
        applicant_name = applicant.name if applicant else "Um candidato"
        NotificationDispatcher(NotificationRepository(self.session)).dispatch(
            user_id=project.owner_id,
            title="Nova proposta para seu projeto",
            message=f"{applicant_name} se candidatou para o projeto {project.title}.",
            notif_type="project_application",
            related_entity_type="project",
            related_entity_id=project.id,
            triggered_by_user_id=application.applicant_id,
        )

    def _dispatch_application_accepted_notification(
        self,
        project: Project,
        application: ProjectApplication,
        conversation: Conversation,
    ) -> None:
        from src.modules.notifications.repository import NotificationRepository
        from src.modules.notifications.service import NotificationDispatcher

        self.session.flush()
        NotificationDispatcher(NotificationRepository(self.session)).dispatch(
            user_id=application.applicant_id,
            title="Você foi aceito no projeto",
            message=f"Sua proposta foi aceita no projeto {project.title}.",
            notif_type="application_accepted",
            related_entity_type="conversation",
            related_entity_id=conversation.id,
            triggered_by_user_id=project.owner_id,
        )

    # ── Project groups (fórum do projeto) ────────────────

    def _ensure_group(self, project: Project) -> ProjectGroup:
        group = (
            self.session.query(ProjectGroup)
            .filter(ProjectGroup.project_id == project.id)
            .first()
        )
        if not group:
            group = ProjectGroup(project_id=project.id)
            self.session.add(group)
            self.session.flush()
        self._ensure_group_member(group.id, project.owner_id)
        return group

    def _ensure_group_member(self, group_id: UUID, user_id: UUID) -> None:
        existing = (
            self.session.query(ProjectGroupMember)
            .filter(
                ProjectGroupMember.group_id == group_id,
                ProjectGroupMember.user_id == user_id,
            )
            .first()
        )
        if not existing:
            self.session.add(ProjectGroupMember(group_id=group_id, user_id=user_id))

    def get_group_by_id(self, group_id: UUID) -> ProjectGroup | None:
        return (
            self.session.query(ProjectGroup)
            .filter(ProjectGroup.id == group_id, ProjectGroup.is_active)
            .first()
        )

    def get_group_by_project_id(self, project_id: UUID) -> ProjectGroup | None:
        return (
            self.session.query(ProjectGroup)
            .filter(ProjectGroup.project_id == project_id, ProjectGroup.is_active)
            .first()
        )

    def is_group_member(self, group_id: UUID, user_id: UUID) -> bool:
        return (
            self.session.query(ProjectGroupMember)
            .filter(
                ProjectGroupMember.group_id == group_id,
                ProjectGroupMember.user_id == user_id,
            )
            .first()
            is not None
        )

    def list_groups_for_user(self, user_id: UUID) -> list[ProjectGroup]:
        return (
            self.session.query(ProjectGroup)
            .join(
                ProjectGroupMember,
                ProjectGroupMember.group_id == ProjectGroup.id,
            )
            .filter(ProjectGroupMember.user_id == user_id, ProjectGroup.is_active)
            .order_by(desc(ProjectGroup.created_at))
            .all()
        )

    def get_group_posts(self, group_id: UUID) -> list[ProjectGroupPost]:
        return (
            self.session.query(ProjectGroupPost)
            .filter(ProjectGroupPost.group_id == group_id, ProjectGroupPost.is_active)
            .order_by(ProjectGroupPost.created_at)
            .all()
        )

    def create_group_post(
        self, group_id: UUID, author_id: UUID, data: GroupPostCreate
    ) -> ProjectGroupPost:
        group = self.get_group_by_id(group_id)
        if not group:
            raise ValueError("Group not found")
        if not self.is_group_member(group_id, author_id):
            raise ValueError("Action Denied: You are not a member of this group")
        post = ProjectGroupPost(
            group_id=group_id,
            author_id=author_id,
            body=sanitize_html(data.body).strip(),
        )
        self.session.add(post)
        self.session.commit()
        self.session.refresh(post)
        return post

    # ── Conversations ─────────────────────────────────────

    def _ensure_conversation(
        self, invitation: ProjectInvitation, initial_message: str
    ) -> Conversation:
        conversation = self.get_conversation_by_invitation_id(invitation.id)
        if not conversation:
            conversation = Conversation(invitation_id=invitation.id)
            self.session.add(conversation)
            self.session.flush()
            self.session.add(
                ConversationParticipant(
                    conversation_id=conversation.id,
                    user_id=invitation.project.owner_id,
                )
            )
            self.session.add(
                ConversationParticipant(
                    conversation_id=conversation.id,
                    user_id=invitation.invited_user_id,
                )
            )
        self.session.add(
            ConversationMessage(
                conversation_id=conversation.id,
                sender_id=invitation.project.owner_id,
                body=sanitize_html(initial_message).strip(),
            )
        )
        return conversation

    def get_conversation_by_invitation_id(
        self, invitation_id: UUID
    ) -> Conversation | None:
        return (
            self.session.query(Conversation)
            .filter(Conversation.invitation_id == invitation_id)
            .first()
        )

    def get_conversation_by_application_id(
        self, application_id: UUID
    ) -> Conversation | None:
        return (
            self.session.query(Conversation)
            .filter(Conversation.application_id == application_id)
            .first()
        )

    def get_conversation_by_id(self, conversation_id: UUID) -> Conversation | None:
        return (
            self.session.query(Conversation)
            .filter(Conversation.id == conversation_id, Conversation.is_active)
            .first()
        )

    def is_conversation_participant(self, conversation_id: UUID, user_id: UUID) -> bool:
        return (
            self.session.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == user_id,
            )
            .first()
            is not None
        )

    def list_conversations(self, user_id: UUID) -> list[Conversation]:
        return (
            self.session.query(Conversation)
            .join(
                ConversationParticipant,
                ConversationParticipant.conversation_id == Conversation.id,
            )
            .filter(ConversationParticipant.user_id == user_id, Conversation.is_active)
            .order_by(desc(Conversation.created_at))
            .all()
        )

    def get_conversation_messages(
        self, conversation_id: UUID
    ) -> list[ConversationMessage]:
        return (
            self.session.query(ConversationMessage)
            .filter(
                ConversationMessage.conversation_id == conversation_id,
                ConversationMessage.is_active,
            )
            .order_by(ConversationMessage.created_at)
            .all()
        )

    def send_message(
        self, conversation_id: UUID, sender_id: UUID, data: MessageCreate
    ) -> ConversationMessage:
        conversation = self.get_conversation_by_id(conversation_id)
        if not conversation:
            raise ValueError("Conversation not found")
        if not self.is_conversation_participant(conversation_id, sender_id):
            raise ValueError("Action Denied: You are not part of this conversation")
        message = ConversationMessage(
            conversation_id=conversation_id,
            sender_id=sender_id,
            body=sanitize_html(data.body).strip(),
        )
        self.session.add(message)
        self.session.flush()
        self._dispatch_new_message_notification(conversation, message)
        self.session.commit()
        self.session.refresh(message)
        return message

    def _dispatch_new_message_notification(
        self, conversation: Conversation, message: ConversationMessage
    ) -> None:
        """Sinaliza a mensagem nova para os OUTROS participantes da conversa.

        O remetente não é notificado. As mensagens que abrem um convite ou uma
        proposta aceita são criadas fora de `send_message` e já têm notificação
        própria (`conversation_invite` / `application_accepted`), então aqui não
        há duplicidade.
        """
        recipients = [
            participant.user_id
            for participant in self.session.query(ConversationParticipant)
            .filter(
                ConversationParticipant.conversation_id == conversation.id,
                ConversationParticipant.user_id != message.sender_id,
            )
            .all()
        ]
        if not recipients:
            return

        sender = self.get_user_by_id(message.sender_id)
        sender_name = sender.name if sender else "Alguém"
        from src.modules.notifications.repository import NotificationRepository
        from src.modules.notifications.service import NotificationDispatcher

        dispatcher = NotificationDispatcher(NotificationRepository(self.session))
        for user_id in recipients:
            dispatcher.dispatch(
                user_id=user_id,
                title=f"Nova mensagem de {sender_name}"[:255],
                message=snippet(plain_text(message.body)),
                notif_type="conversation_message",
                related_entity_type="conversation",
                related_entity_id=conversation.id,
                triggered_by_user_id=message.sender_id,
            )

    # ── Perfil do membro e comentários sobre o trabalho ──
    def get_user_by_id(self, user_id: UUID) -> User | None:
        return self.session.query(User).filter(User.id == user_id).first()

    def get_member_profile(self, user_id: UUID) -> User:
        """Perfil do membro ou ValueError('User not found') — 404 no router."""
        user = self.get_user_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        return user

    def get_member_company_name(self, user: User) -> str | None:
        """Nome da empresa do próprio BPO: fantasia -> razão social -> legado."""
        return user.company_nome_fantasia or user.company_razao_social or user.company

    def count_active_profile_comments(self, user_id: UUID) -> int:
        return (
            self.session.query(func.count(ProfileComment.id))
            .filter(ProfileComment.user_id == user_id, ProfileComment.is_active)
            .scalar()
            or 0
        )

    def create_profile_comment(
        self, user_id: UUID, author_id: UUID, data: ProfileCommentCreate
    ) -> ProfileComment:
        """Comenta no perfil de outro membro (texto simples, publica na hora)."""
        self.get_member_profile(user_id)
        if user_id == author_id:
            raise ValueError("You cannot comment on your own profile.")
        message = data.message.strip()
        if not message:
            raise ValueError("Comment cannot be empty")
        comment = ProfileComment(
            user_id=user_id,
            author_id=author_id,
            message=message,
        )
        self.session.add(comment)
        self.session.commit()
        self.session.refresh(comment)
        self._dispatch_profile_comment_notification(comment)
        return comment

    def list_profile_comments(
        self, user_id: UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[ProfileComment], int]:
        self.get_member_profile(user_id)
        base = self.session.query(ProfileComment).filter(
            ProfileComment.user_id == user_id, ProfileComment.is_active
        )
        total = base.count()
        items = (
            base.order_by(ProfileComment.created_at.desc(), ProfileComment.id.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return items, total

    def get_profile_comment_by_id(self, comment_id: UUID) -> ProfileComment | None:
        return (
            self.session.query(ProfileComment)
            .filter(ProfileComment.id == comment_id, ProfileComment.is_active)
            .first()
        )

    def delete_profile_comment(self, comment_id: UUID, actor_id: UUID) -> None:
        """Soft delete: só o autor do comentário ou o dono do perfil."""
        comment = self.get_profile_comment_by_id(comment_id)
        if not comment:
            raise ValueError("Comment not found")
        if actor_id not in (comment.author_id, comment.user_id):
            raise ValueError(
                "Action Denied: You can only delete your own comment "
                "or comments on your own profile."
            )
        comment.is_active = False
        comment.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def _dispatch_profile_comment_notification(self, comment: ProfileComment) -> None:
        from src.modules.notifications.repository import NotificationRepository
        from src.modules.notifications.service import NotificationDispatcher

        self.session.flush()
        author_name = comment.author.name if comment.author else "Um membro"
        NotificationDispatcher(NotificationRepository(self.session)).dispatch(
            user_id=comment.user_id,
            title="Comentário sobre o seu trabalho",
            message=f"{author_name} comentou no seu perfil na Comunidade.",
            notif_type="profile_comment",
            related_entity_type="member_profile",
            related_entity_id=comment.user_id,
            triggered_by_user_id=comment.author_id,
        )
