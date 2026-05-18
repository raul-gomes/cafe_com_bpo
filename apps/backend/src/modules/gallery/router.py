import os
import uuid
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import FileResponse
from typing import List
from typing import Annotated
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.core.config import get_settings
from src.core.logger import log
from src.modules.auth.service import get_current_user
from src.modules.auth.schemas import UserResponse
from src.modules.gallery.schemas import GalleryItemCreate, GalleryItemResponse
from src.modules.gallery.service import GalleryService
from src.modules.gallery.repository import GalleryRepository

router = APIRouter(prefix="/gallery", tags=["gallery"])

settings = get_settings()

STORAGE_DIR = "storage/gallery"
os.makedirs(STORAGE_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


def get_gallery_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> GalleryService:
    return GalleryRepository(session)


@router.get("/", response_model=List[GalleryItemResponse])
def list_gallery_files(
    user: CurrentUserDep, session: Annotated[Session, Depends(get_db_session)]
):
    """Lista todos os arquivos de galeria do usuário autenticado."""
    repo = GalleryRepository(session)
    return repo.get_by_user(user.id)


@router.post("/upload", response_model=GalleryItemResponse, status_code=201)
async def upload_gallery_file(
    user: CurrentUserDep,
    session: Annotated[Session, Depends(get_db_session)],
    file: UploadFile = File(...),
    title: str = Query(default=""),
    description: str = Query(default=""),
):
    """Upload de arquivo de galeria com validação e isolamento por usuário."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato não permitido. Aceitos: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413, detail="Arquivo muito grande. Limite de 10MB."
        )

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(STORAGE_DIR, safe_filename)

    with open(filepath, "wb") as f:
        f.write(content)

    item_data = GalleryItemCreate(
        file_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        title=title if title else None,
        description=description if description else None,
    )

    repo = GalleryRepository(session)
    item = repo.create(
        item_data=item_data.model_dump(),
        user_id=user.id,
        file_url=f"/gallery/download/{safe_filename}",
    )

    log.info(f"📁 Arquivo enviado para galeria: {file.filename} por {user.email}")

    return GalleryItemResponse(
        id=item.id,
        file_name=item.file_name,
        file_path=item.file_path,
        file_type=item.file_type,
        file_size=item.file_size,
        title=item.title,
        description=item.description,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/download/{filename}")
def download_gallery_file(filename: str):
    """Serve arquivo da galeria para download."""
    filename = os.path.basename(filename)
    filepath = os.path.join(STORAGE_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=404, detail="Arquivo não encontrado na galeria."
        )

    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/octet-stream",
        content_disposition_type="attachment",
    )


@router.delete("/{item_id}", status_code=204)
def delete_gallery_file(
    item_id: uuid.UUID,
    user: CurrentUserDep,
    session: Annotated[Session, Depends(get_db_session)],
):
    """Exclui um arquivo da galeria (permissões por usuário)."""
    repo = GalleryRepository(session)
    item = repo.get_by_id(item_id, user.id)

    if not item:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")

    # Remove physical file
    local_path = os.path.join(STORAGE_DIR, os.path.basename(item.file_path))
    if os.path.exists(local_path):
        os.remove(local_path)

    repo.delete(item)
    log.info(f"🗑️ Arquivo excluído da galeria: {item.file_name} por {user.email}")
