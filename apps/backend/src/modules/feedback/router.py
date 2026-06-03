from typing import Annotated

from fastapi import APIRouter, Depends

from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.feedback.schemas import FeedbackCreate, FeedbackResponse
from src.modules.feedback.service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["Feedback"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/", response_model=FeedbackResponse)
def send_feedback(
    feedback_in: FeedbackCreate,
    current_user: CurrentUserDep,
):
    """Envia um relato de erro/feedback para o email de suporte."""
    FeedbackService.send_feedback(
        title=feedback_in.title,
        description=feedback_in.description,
        user_name=current_user.name,
        user_email=current_user.email,
    )
    return FeedbackResponse()
