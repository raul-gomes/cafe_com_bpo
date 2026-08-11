"""
Attachments Module - Service Layer

Business logic for task attachment management (upload, list, delete).
"""

from uuid import UUID

from src.core.logger import log

from ..attachments.repository import AttachmentRepository
from ..schemas import TaskAttachmentResponse
from ..task.repository import TaskRepository


class AttachmentService:
    """Service layer for attachment operations."""

    def __init__(
        self,
        attachment_repo: AttachmentRepository,
        task_repo: TaskRepository | None = None,
    ):
        self.attachment_repo = attachment_repo
        self.task_repo = task_repo or TaskRepository(attachment_repo.session)

    def get_task_attachments(
        self, task_id: UUID, user_id: UUID
    ) -> list[TaskAttachmentResponse]:
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
        file_size: int | None,
        content_type: str | None,
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
