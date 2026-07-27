"""
Attachments Module - Service Layer

Business logic for task attachment management (upload, list, delete).
"""

from typing import List, Optional
from uuid import UUID

from ..schemas import TaskAttachmentResponse
from ..attachments.repository import AttachmentRepository
from ..task.repository import TaskRepository
from src.core.logger import log


class AttachmentService:
    """Service layer for attachment operations."""

    def __init__(
        self,
        attachment_repo: AttachmentRepository,
        task_repo: Optional[TaskRepository] = None,
    ):
        self.attachment_repo = attachment_repo
        self.task_repo = task_repo or TaskRepository(attachment_repo.session)

    def get_task_attachments(
        self, task_id: UUID, user_id: UUID
    ) -> List[TaskAttachmentResponse]:
        task = self.task_repo.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        attachments = self.attachment_repo.get_attachments_by_task(task_id)
        return [TaskAttachmentResponse.model_validate(a) for a in attachments]

    def upload_attachment(
        self,
        task_id: UUID,
        user_id: UUID,
        file_name: str,
        file_path: str,
        file_size: Optional[int],
        content_type: Optional[str],
    ) -> TaskAttachmentResponse:
        task = self.task_repo.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        att = self.attachment_repo.create_attachment(
            task_id=task_id,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            content_type=content_type,
            uploaded_by=user_id,
        )
        log.info(f"📎 Anexo adicionado à tarefa {task_id}: {file_name}")
        return TaskAttachmentResponse.model_validate(att)

    def delete_attachment(self, attachment_id: UUID, user_id: UUID) -> None:
        att = self.attachment_repo.get_attachment_by_id(attachment_id)
        if not att:
            raise ValueError(f"Attachment {attachment_id} not found")
        # Verify task ownership
        task = self.task_repo.get_by_id(att.task_id, user_id)
        if not task:
            raise ValueError(f"Task {att.task_id} not found for user")
        # Delete file from disk
        import os

        if os.path.exists(att.file_path):
            os.remove(att.file_path)
        self.attachment_repo.delete_attachment(att)
