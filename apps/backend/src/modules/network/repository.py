import re
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from .models import DiscussionComment, DiscussionPost, Skill, UserSkill
from .schemas import CommentCreate, PostCreate


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
