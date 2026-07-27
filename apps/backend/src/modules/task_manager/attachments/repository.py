from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from datetime import datetime, timezone
from ..models import TaskAttachment


class AttachmentRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_attachments_by_task(self, task_id: UUID) -> List[TaskAttachment]:
        return (
            self.session.query(TaskAttachment)
            .filter(TaskAttachment.task_id == task_id)
            .order_by(TaskAttachment.created_at.desc())
            .all()
        )

    def get_attachment_by_id(self, attachment_id: UUID) -> Optional[TaskAttachment]:
        return (
            self.session.query(TaskAttachment)
            .filter(TaskAttachment.id == attachment_id)
            .first()
        )

    def create_attachment(
        self,
        task_id: UUID,
        file_name: str,
        file_path: str,
        file_size: Optional[int],
        content_type: Optional[str],
        uploaded_by: UUID,
    ) -> TaskAttachment:
        att = TaskAttachment(
            task_id=task_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            content_type=content_type,
            uploaded_by=uploaded_by,
        )
        self.session.add(att)
        self.session.commit()
        self.session.refresh(att)
        return att

    def delete_attachment(self, attachment: TaskAttachment) -> None:
        self.session.delete(attachment)
        self.session.commit()

    def mark_attachment_sent(self, attachment: TaskAttachment) -> None:
        attachment.sent_to_client = True
        attachment.sent_at = datetime.now(timezone.utc)
        self.session.commit()
