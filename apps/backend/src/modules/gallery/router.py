import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
import uuid

router = APIRouter(prefix="/api/gallery", tags=["gallery"])

STORAGE_DIR = "storage/gallery"

class FileMetadata(BaseModel):
    name: str
    size: int
    extension: str
    last_modified: str

def get_file_extension(filename: str) -> str:
    return os.path.splitext(filename)[1].lower()

@router.get("/", response_model=List[FileMetadata])
def list_gallery_files():
    """
    Lista todos os arquivos na pasta de galeria compartilhada.
    """
    if not os.path.exists(STORAGE_DIR):
        return []
    
    files = []
    for filename in os.listdir(STORAGE_DIR):
        filepath = os.path.join(STORAGE_DIR, filename)
        if os.path.isfile(filepath):
            stats = os.stat(filepath)
            files.append(FileMetadata(
                name=filename,
                size=stats.st_size,
                extension=get_file_extension(filename),
                last_modified=str(stats.st_mtime)
            ))
    
    # Ordenar por nome
    files.sort(key=lambda x: x.name)
    return files

@router.get("/download/{filename}")
def download_gallery_file(filename: str):
    """
    Serve um arquivo da galeria para download.
    """
    # Segurança básica para impedir Directory Traversal
    filename = os.path.basename(filename)
    filepath = os.path.join(STORAGE_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado na galeria.")
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type='application/octet-stream',
        content_disposition_type="attachment"
    )
