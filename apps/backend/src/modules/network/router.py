from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db_session
from src.modules.auth.models import User
from src.modules.auth.service import get_current_user

from .repository import NetworkRepository
from .schemas import (
    CommentCreate,
    CommentResponse,
    PaginatedPosts,
    PostCreate,
    PostResponse,
    SkillResponse,
    UserSkillCreate,
)

router = APIRouter(prefix="/network", tags=["Network"])


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    return repo.create_post(current_user.id, post_data)


@router.get("/posts", response_model=PaginatedPosts)
def get_posts(
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    items, total = repo.get_posts(limit, offset)
    return {"items": items, "total": total}


@router.get("/posts/{post_id}", response_model=PostResponse)
def get_post(
    post_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
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
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        repo.delete_post(post_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/posts/{post_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    post_id: UUID,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        return repo.create_comment(post_id, current_user.id, comment_data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        repo.delete_comment(comment_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/posts/{post_id}/comments", response_model=list[CommentResponse])
def get_post_comments(
    post_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    return repo.get_comments(post_id)


# ── Skills ──────────────────────────────────────────────


@router.get("/skills", response_model=list[SkillResponse])
def search_skills(
    query: str = "",
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    return repo.search_skills(query, limit)


@router.get("/me/skills", response_model=list[SkillResponse])
def get_my_skills(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    return repo.get_user_skills(current_user.id)


@router.post(
    "/me/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED
)
def add_my_skill(
    skill_data: UserSkillCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    return repo.add_user_skill(current_user.id, skill_data.name)


@router.delete("/me/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_my_skill(
    skill_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        repo.remove_user_skill(current_user.id, skill_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
