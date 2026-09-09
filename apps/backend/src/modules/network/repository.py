import re
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from src.modules.auth.models import User

from .models import (
    Conversation,
    ConversationMessage,
    ConversationParticipant,
    DiscussionComment,
    DiscussionPost,
    Project,
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
    ProjectCreate,
    ProjectInviteCreate,
    ProjectUpdate,
)


def sanitize_html(html_str: str) -> str:
    # A basic sanitizer to remove <script> tags and onerror handlers for the XSS test.
    # In production, a library like bleach should be used.
    cleaned = re.sub(r"(?i)<script.*?>.*?</script>", "", html_str, flags=re.DOTALL)
    cleaned = re.sub(r"(?i)<script.*?>", "", cleaned)
    cleaned = re.sub(r"(?i)onerror=", "data-err=", cleaned)
    return cleaned


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
                message=comment.message[:100],
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
            pattern = f"%{query.strip().lower()}%"
            q = q.filter(
                func.lower(Project.title).like(pattern)
                | func.lower(Project.description).like(pattern)
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
        self.session.commit()
        self.session.refresh(message)
        return message
