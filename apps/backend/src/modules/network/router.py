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
    ConversationDetail,
    ConversationListItem,
    MessageCreate,
    MessageResponse,
    PaginatedPosts,
    PaginatedProjects,
    PostCreate,
    PostResponse,
    ProfessionalMatch,
    ProjectCreate,
    ProjectInvitationResponse,
    ProjectInviteCreate,
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


# ── Invitations ─────────────────────────────────────────


def _invitation_response(
    repo: NetworkRepository, invitation
) -> ProjectInvitationResponse:
    conversation_id = None
    if invitation.status == "accepted":
        conversation = repo.get_conversation_by_invitation_id(invitation.id)
        conversation_id = conversation.id if conversation else None
    return ProjectInvitationResponse(
        id=invitation.id,
        project_id=invitation.project_id,
        project_title=invitation.project.title,
        invited_user=UserPublic.model_validate(invitation.invited_user),
        message=invitation.message,
        status=invitation.status,
        responded_at=invitation.responded_at,
        created_at=invitation.created_at,
        conversation_id=conversation_id,
    )


@router.post(
    "/projects/{project_id}/invites",
    response_model=ProjectInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_invitation(
    project_id: UUID,
    invite_data: ProjectInviteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        invitation = repo.create_invitation(project_id, current_user.id, invite_data)
    except ValueError as e:
        if "Action Denied" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        if "User not found" in str(e):
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    return _invitation_response(repo, invitation)


@router.get(
    "/projects/{project_id}/invites", response_model=list[ProjectInvitationResponse]
)
def get_project_invitations(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        invitations = repo.get_project_invitations(project_id, current_user.id)
    except ValueError as e:
        if "Action Denied" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    return [_invitation_response(repo, i) for i in invitations]


@router.get("/me/invites", response_model=list[ProjectInvitationResponse])
def get_my_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    invitations = repo.get_my_invitations(current_user.id)
    return [_invitation_response(repo, i) for i in invitations]


def _respond_invitation(
    invitation_id: UUID, current_user: User, db: Session, accept: bool
) -> ProjectInvitationResponse:
    repo = NetworkRepository(db)
    try:
        invitation = repo.respond_invitation(invitation_id, current_user.id, accept)
    except ValueError as e:
        if "Action Denied" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    return _invitation_response(repo, invitation)


@router.post(
    "/invites/{invitation_id}/accept", response_model=ProjectInvitationResponse
)
def accept_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    return _respond_invitation(invitation_id, current_user, db, accept=True)


@router.post(
    "/invites/{invitation_id}/decline", response_model=ProjectInvitationResponse
)
def decline_invitation(
    invitation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    return _respond_invitation(invitation_id, current_user, db, accept=False)


# ── Conversations ───────────────────────────────────────


def _conversation_item(
    repo: NetworkRepository, conversation, viewer_id: UUID
) -> ConversationListItem:
    participants = conversation.participants
    other = next((p.user for p in participants if p.user_id != viewer_id), None)
    messages = repo.get_conversation_messages(conversation.id)
    last = messages[-1] if messages else None
    return ConversationListItem(
        id=conversation.id,
        project_id=conversation.invitation.project_id,
        project_title=conversation.invitation.project.title,
        participant=UserPublic.model_validate(other),
        last_message=last.body[:120] if last else None,
        last_message_at=last.created_at if last else None,
        created_at=conversation.created_at,
    )


def _conversation_detail(
    repo: NetworkRepository, conversation, messages
) -> ConversationDetail:
    participants = sorted(
        (UserPublic.model_validate(p.user) for p in conversation.participants),
        key=lambda u: (u.name or "").lower(),
    )
    return ConversationDetail(
        id=conversation.id,
        project_id=conversation.invitation.project_id,
        project_title=conversation.invitation.project.title,
        participants=participants,
        messages=[MessageResponse.model_validate(m) for m in messages],
        created_at=conversation.created_at,
    )


@router.get("/conversations", response_model=list[ConversationListItem])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    conversations = repo.list_conversations(current_user.id)
    return [_conversation_item(repo, c, current_user.id) for c in conversations]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    conversation = repo.get_conversation_by_id(conversation_id)
    if not conversation or not repo.is_conversation_participant(
        conversation_id, current_user.id
    ):
        raise HTTPException(status_code=404, detail="Conversation not found")
    messages = repo.get_conversation_messages(conversation_id)
    return _conversation_detail(repo, conversation, messages)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_message(
    conversation_id: UUID,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    repo = NetworkRepository(db)
    try:
        message = repo.send_message(conversation_id, current_user.id, message_data)
    except ValueError as e:
        if "Action Denied" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    return MessageResponse.model_validate(message)
