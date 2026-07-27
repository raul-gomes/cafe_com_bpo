from fastapi import APIRouter, Depends, HTTPException, status, UploadFile
from typing import Annotated, List
from uuid import UUID
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user

from ..schemas import TaskAttachmentResponse
from ..attachments.repository import AttachmentRepository
from ..attachments.service import AttachmentService
from ..task.repository import TaskRepository

router = APIRouter(prefix="/tasks", tags=["tasks"])

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
}

FILE_UPLOAD_MAX_SIZE = 20 * 1024 * 1024  # 20 MB


def get_attachment_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> AttachmentService:
    return AttachmentService(
        AttachmentRepository(session),
        task_repo=TaskRepository(session),
    )


AttachmentServiceDep = Annotated[AttachmentService, Depends(get_attachment_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post(
    "/{task_id}/attachments/",
    response_model=TaskAttachmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: UUID,
    service: AttachmentServiceDep,
    current_user: CurrentUserDep,
    file: UploadFile,
):
    """Faz upload de arquivo como anexo de tarefa."""
    import os

    ext = (
        os.path.splitext(file.filename or "file")[1].lower()
        if file.filename
        else ""
    )
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato de arquivo não permitido: {ext}. "
            f"Use: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de arquivo não permitido: {file.content_type}.",
        )

    content = await file.read()
    if len(content) > FILE_UPLOAD_MAX_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande. Limite de {FILE_UPLOAD_MAX_SIZE // (1024 * 1024)}MB.",
        )

    storage_dir = "storage/tasks"
    os.makedirs(storage_dir, exist_ok=True)

    ext = os.path.splitext(file.filename or "file")[1] if file.filename else ""
    import uuid as uuid_gen

    safe_name = f"{uuid_gen.uuid4().hex}{ext}"
    file_path = os.path.join(storage_dir, safe_name)

    file_size = 0
    try:
        with open(file_path, "wb") as f:
            f.write(content)
            file_size = len(content)
    except Exception:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="Erro ao salvar arquivo")

    try:
        att = service.upload_attachment(
            task_id=task_id,
            user_id=current_user.id,
            file_name=file.filename or "unknown",
            file_path=file_path,
            file_size=file_size,
            content_type=file.content_type,
        )
        return att
    except ValueError as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{task_id}/attachments/", response_model=List[TaskAttachmentResponse])
def list_attachments(
    task_id: UUID, service: AttachmentServiceDep, current_user: CurrentUserDep
):
    """Lista os anexos de uma tarefa."""
    try:
        return service.get_task_attachments(task_id, current_user.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")


@router.delete(
    "/{task_id}/attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_attachment(
    task_id: UUID,
    attachment_id: UUID,
    service: AttachmentServiceDep,
    current_user: CurrentUserDep,
):
    """Remove um anexo de uma tarefa."""
    try:
        service.delete_attachment(attachment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return None
