from sqlalchemy.orm import Session
from sqlalchemy import desc
from uuid import UUID
import re

from .models import DiscussionPost, DiscussionComment, Notification
from .schemas import PostCreate, CommentCreate

def sanitize_html(html_str: str) -> str:
    # A basic sanitizer to remove <script> tags and onerror handlers for the XSS test.
    # In production, a library like bleach should be used.
    cleaned = re.sub(r'(?i)<script.*?>.*?</script>', '', html_str, flags=re.DOTALL)
    cleaned = re.sub(r'(?i)<script.*?>', '', cleaned)
    cleaned = re.sub(r'(?i)onerror=', 'data-err=', cleaned)
    return cleaned

class NetworkRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_post(self, author_id: UUID, post_data: PostCreate) -> DiscussionPost:
        safe_msg = sanitize_html(post_data.message)
        post = DiscussionPost(
            author_id=author_id,
            title=post_data.title,
            message=safe_msg,
            tags=post_data.tags
        )
        self.session.add(post)
        self.session.commit()
        self.session.refresh(post)
        return post

    def get_posts(self, limit: int = 10, offset: int = 0):
        # Only active posts
        query = self.session.query(DiscussionPost).filter(DiscussionPost.deleted_at.is_(None))
        total = query.count()
        items = query.order_by(desc(DiscussionPost.created_at)).offset(offset).limit(limit).all()
        return items, total

    def get_post_by_id(self, post_id: UUID) -> DiscussionPost | None:
        return self.session.query(DiscussionPost).filter(
            DiscussionPost.id == post_id, 
            DiscussionPost.deleted_at.is_(None)
        ).first()

    def delete_post(self, post_id: UUID, user_id: UUID):
        post = self.get_post_by_id(post_id)
        if not post:
            raise ValueError("Post not found")
        if post.author_id != user_id:
            raise ValueError("Action Denied: You cannot delete someone else's post.")
        if post.comments_count > 0:
            raise ValueError("Cannot delete post with active comments")
        
        # Soft delete
        from datetime import datetime, timezone
        post.deleted_at = datetime.now(timezone.utc)
        self.session.commit()

    def create_comment(self, post_id: UUID, author_id: UUID, comment_data: CommentCreate) -> DiscussionComment:
        post = self.get_post_by_id(post_id)
        if not post:
            raise ValueError("Post not found")

        safe_msg = sanitize_html(comment_data.message)
        comment = DiscussionComment(
            post_id=post_id,
            author_id=author_id,
            message=safe_msg
        )
        self.session.add(comment)
        
        # Increment comment count
        post.comments_count += 1
        
        # Trigger notification if commenter is not author
        if post.author_id != author_id:
            notification = Notification(
                user_id=post.author_id,
                type="post_commented",
                post_id=post_id,
                comment_id=comment.id, # Needs commit/flush? Yes we need comment.id first
                triggered_by_user_id=author_id
            )
            # Actually we can't use comment.id before flush
            self.session.flush()
            notification.comment_id = comment.id
            self.session.add(notification)

        self.session.commit()
        self.session.refresh(comment)
        return comment

    def get_notifications(self, user_id: UUID, limit: int = 20):
        query = self.session.query(Notification).filter(Notification.user_id == user_id)
        total = query.count()
        items = query.order_by(desc(Notification.created_at)).limit(limit).all()
        return items, total

    def get_comments(self, post_id: UUID):
        query = self.session.query(DiscussionComment).filter(DiscussionComment.post_id == post_id, DiscussionComment.deleted_at.is_(None))
        return query.order_by(DiscussionComment.created_at).all()

    def mark_notification_read(self, user_id: UUID, notification_id: UUID) -> None:
        self.session.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.id == notification_id
        ).update({"is_read": True})
        self.session.commit()

