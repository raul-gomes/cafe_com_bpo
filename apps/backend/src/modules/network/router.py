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
    PaginatedProjects,
    PostCreate,
    PostResponse,
    ProfessionalMatch,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    SkillResponse,
    UserPublic,
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


# ── Projects ────────────────────────────────────────────


def _project_response(repo: NetworkRepository, project) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        owner_id=project.owner_id,
        owner=UserPublic.model_validate(project.owner),
        title=project.title,
        description=project.description,
        status=project.status,
        team_size=project.team_size,
        remote_type=project.remote_type,
        skills=sorted(
            (SkillResponse.model_validate(ps.skill) for ps in project.skills),
            key=lambda s: s.name,
        ),
        published_at=project.published_at,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _professional_response(repo: NetworkRepository, user: User) -> ProfessionalMatch:
    skills = repo.get_user_skills(user.id)
    return ProfessionalMatch(
        id=user.id,
        name=user.name,
        email=user.email,
        biografia=user.biografia,
        skills=sorted(
            (SkillResponse.model_validate(s) for s in skills), key=lambda s: s.name
        ),
    )


@router.post(
    "/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED
)
def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    return _project_response(repo, repo.create_project(current_user.id, project_data))


@router.get("/projects", response_model=PaginatedProjects)
def get_projects(
    limit: int = 10,
    offset: int = 0,
    query: str = "",
    skills: str = "",
    status_filter: str | None = None,
    remote_type: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    skill_list = [s.strip() for s in skills.split(",") if s.strip()]
    items, total = repo.get_projects(
        limit,
        offset,
        query=query,
        skills=skill_list,
        status=status_filter,
        remote_type=remote_type,
    )
    return {
        "items": [_project_response(repo, p) for p in items],
        "total": total,
    }


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    project = repo.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_response(repo, project)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        project = repo.update_project(project_id, current_user.id, project_data)
    except ValueError as e:
        if "Action Denied" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    return _project_response(repo, project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        repo.delete_project(project_id, current_user.id)
    except ValueError as e:
        if "Action Denied" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))


# ── Search professionals ────────────────────────────────


@router.get("/users/search", response_model=list[ProfessionalMatch])
def search_professionals(
    skills: str = "",
    mode: str = "any",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    skill_list = [s.strip() for s in skills.split(",") if s.strip()]
    if not skill_list:
        raise HTTPException(status_code=422, detail="Informe ao menos uma skill")
    if mode not in ("any", "all"):
        raise HTTPException(status_code=422, detail="mode deve ser 'any' ou 'all'")
    repo = NetworkRepository(db)
    users = repo.search_professionals(skill_list, mode, exclude_user_id=current_user.id)
    return [_professional_response(repo, u) for u in users]
