from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from src.modules.auth.schemas import UserResponse
from src.modules.auth.service import get_current_user
from src.modules.feedback.schemas import FeedbackResponse
from src.modules.feedback.service import FeedbackService

router = APIRouter(prefix="/feedback", tags=["Feedback"])

CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]

# Print anexado ao relato: só imagem, até 3 MB (vai em base64 na fila de e-mail).
MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024
_IMAGE_SIGNATURES: tuple[tuple[bytes, str], ...] = (
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
)


def _image_extension(content: bytes) -> str | None:
    """Tipo real pelo conteúdo (assinatura), nunca pelo nome ou content-type."""
    for signature, extension in _IMAGE_SIGNATURES:
        if content.startswith(signature):
            return extension
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "webp"
    return None


async def _read_screenshot(screenshot: UploadFile | None) -> tuple[str, bytes] | None:
    if screenshot is None:
        return None
    content = await screenshot.read(MAX_SCREENSHOT_BYTES + 1)
    if not content:
        return None
    if len(content) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(status_code=413, detail="O print deve ter até 3 MB.")
    extension = _image_extension(content)
    if extension is None:
        raise HTTPException(
            status_code=422, detail="O print precisa ser uma imagem PNG, JPG ou WEBP."
        )
    # Nome gerado no servidor: o nome enviado pelo cliente é descartado.
    return f"print-do-erro.{extension}", content


@router.post("/", response_model=FeedbackResponse)
async def send_feedback(
    current_user: CurrentUserDep,
    title: Annotated[str, Form(min_length=3, max_length=200)],
    description: Annotated[str, Form(min_length=10, max_length=2000)],
    screenshot: Annotated[UploadFile | None, File()] = None,
):
    """Envia um relato de erro/feedback (com print opcional) ao suporte."""
    FeedbackService.send_feedback(
        title=title.strip(),
        description=description.strip(),
        user_name=current_user.name,
        user_email=current_user.email,
        screenshot=await _read_screenshot(screenshot),
    )
    return FeedbackResponse()
