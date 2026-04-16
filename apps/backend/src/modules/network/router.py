from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db_session
from src.modules.auth.service import get_current_user
from src.modules.auth.models import User
from .schemas import (
    PostCreate, PostResponse, PaginatedPosts,
    CommentCreate, CommentResponse,
    PaginatedNotifications
)
from .repository import NetworkRepository

router = APIRouter(prefix="/api/network", tags=["Network"])

@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    repo = NetworkRepository(db)
    return repo.create_post(current_user.id, post_data)

@router.get("/posts", response_model=PaginatedPosts)
def get_posts(
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    repo = NetworkRepository(db)
    items, total = repo.get_posts(limit, offset)
    return {"items": items, "total": total}

@router.get("/posts/{post_id}", response_model=PostResponse)
def get_post(
    post_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    repo = NetworkRepository(db)
    post = repo.get_post_by_id(post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    repo = NetworkRepository(db)
    try:
        repo.delete_post(post_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    post_id: UUID,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    repo = NetworkRepository(db)
    try:
        return repo.create_comment(post_id, current_user.id, comment_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/notifications", response_model=PaginatedNotifications)
def get_notifications(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session)
):
    repo = NetworkRepository(db)
    items, total = repo.get_notifications(current_user.id, limit)
    return {"items": items, "total": total}
