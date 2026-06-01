from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from sqlalchemy.orm import Session
import os

from src.core.database import get_db_session
from src.core.logger import log
from src.core.config import get_settings
from src.core.email import EmailService
from .schemas import (
    UserCreate,
    UserResponse,
    ProfileUpdate,
    TokenResponse,
    RefreshTokenRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from .service import AuthService, get_current_user
from .oauth.service import OAuthStateService, GoogleOAuthProvider
from .models import UserFile
from .storage_service import CloudinaryService

router = APIRouter(prefix="/auth", tags=["auth"])

settings = get_settings()


def get_auth_service(
    session: Annotated[Session, Depends(get_db_session)],
) -> AuthService:
    return AuthService(session)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]


@router.post("/register", response_model=UserResponse, status_code=201)
def register(user_data: UserCreate, service: AuthServiceDep):
    try:
        new_user = service.register_user(user_data)
        log.info(
            f"💾 Novo usuário registrado: {user_data.email} | Empresa: {user_data.company or 'N/A'}"
        )
        return new_user
    except ValueError as e:
        log.warning(f"⚠️ Falha de validação no registro ({user_data.email}): {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()], service: AuthServiceDep
):
    tokens = service.authenticate_user(form_data.username, form_data.password)
    if not tokens:
        log.warning(f"🚫 Tentativa de login inválida: {form_data.username}")
        raise HTTPException(status_code=401, detail="Credenciais inválidas")

    log.info(f"🔑 Usuário logado com sucesso: {form_data.username}")
    return {
        "access_token": tokens["access_token"],
        "refresh_token": tokens["refresh_token"],
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: RefreshTokenRequest, service: AuthServiceDep):
    try:
        tokens = service.refresh_access_token(data.refresh_token)
        return {
            "access_token": tokens["access_token"],
            "refresh_token": tokens["refresh_token"],
            "token_type": "bearer",
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me", response_model=UserResponse)
def get_me(user: CurrentUserDep, service: AuthServiceDep):
    return service.get_user_profile(user.id)


@router.patch("/me", response_model=UserResponse)
def update_me(updates: ProfileUpdate, user: CurrentUserDep, service: AuthServiceDep):
    filtered = updates.model_dump(exclude_unset=True)
    # Never allow email change via this endpoint
    filtered.pop("email", None)
    if not filtered:
        raise HTTPException(
            status_code=400, detail="Nenhum campo válido para atualizar"
        )

    result = service.update_user_profile(user.id, **filtered)
    if not result:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    log.info(f"✏️ Perfil atualizado: {user.email} | Campos: {list(filtered.keys())}")
    return result


@router.post("/forgot-password", status_code=200)
def forgot_password(data: ForgotPasswordRequest, service: AuthServiceDep):
    user = service.user_repo.get_user_by_email(data.email)
    if not user:
        raise HTTPException(
            status_code=404, detail="Nenhuma conta encontrada com este e-mail."
        )

    if user.auth_provider != "local":
        raise HTTPException(
            status_code=400,
            detail=f"Esta conta usa login com {user.auth_provider.capitalize()}. Faça login pelo {user.auth_provider.capitalize()}.",
        )

    token = service.create_reset_token(data.email)
    EmailService.send_reset_password_email(data.email, token)
    log.info(f"🔑 Solicitação de redefinição de senha: {data.email}")
    return {"message": "Instruções enviadas para seu e-mail."}


@router.post("/reset-password", status_code=200)
def reset_password(data: ResetPasswordRequest, service: AuthServiceDep):
    success = service.reset_password(data.token, data.new_password)
    if not success:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")
    log.info("🔑 Senha redefinida com sucesso.")
    return {"message": "Senha redefinida com sucesso."}


@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    user: CurrentUserDep, service: AuthServiceDep, file: UploadFile = File(...)
):
    valid_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=400, detail="Formato de imagem inválido. Use PNG, JPG ou WEBP."
        )

    content = await file.read()
    if len(content) > settings.file_upload_max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande. Limite de {settings.file_upload_max_size // (1024 * 1024)}MB.",
        )

    db_user = service.user_repo.get_user_by_id(user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    new_file_record = UserFile(
        user_id=db_user.id,
        category="avatar",
        provider="cloudinary",
        status="pending",
        mime_type=file.content_type or "image/png",
        size_bytes=len(content),
        original_file_name=file.filename or "avatar.png",
    )
    service.user_repo.session.add(new_file_record)
    service.user_repo.session.flush()

    old_avatar_file = db_user.avatar_file

    try:
        upload_res = await CloudinaryService.upload_file(content, str(user.id))
        public_id = upload_res["id"]
        read_url = upload_res["url"]

        new_file_record.provider_item_id = public_id
        new_file_record.read_url = read_url
        new_file_record.status = "active"

        db_user.avatar_file_id = new_file_record.id
        db_user.avatar_url = read_url

        service.user_repo.session.commit()
        log.info(f"🖼️ Avatar Cloudinary ativo: {db_user.email} | URL: {read_url}")

        if old_avatar_file and old_avatar_file.provider_item_id:
            await CloudinaryService.delete_file(old_avatar_file.provider_item_id)
            old_avatar_file.status = "deleted"
            service.user_repo.session.commit()

    except Exception as e:
        service.user_repo.session.rollback()
        new_file_record.status = "failed"
        service.user_repo.session.add(new_file_record)
        service.user_repo.session.commit()
        log.error(f"❌ Falha no upload Cloudinary: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Falha ao processar upload no storage remoto."
        )

    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        company=db_user.company,
        company_name=db_user.company_name,
        company_segment=db_user.company_segment,
        company_description=db_user.company_description,
        avatar_url=read_url,
        whatsapp=db_user.whatsapp,
        company_razao_social=db_user.company_razao_social,
        company_nome_fantasia=db_user.company_nome_fantasia,
        company_cnpj=db_user.company_cnpj,
        company_address=db_user.company_address,
        company_professional_email=db_user.company_professional_email,
        company_commercial_phone=db_user.company_commercial_phone,
        company_logo_url=db_user.company_logo_url,
        company_color_code=db_user.company_color_code,
        company_color_secondary=db_user.company_color_secondary,
    )


@router.post("/me/company-logo", response_model=UserResponse)
async def upload_company_logo(
    user: CurrentUserDep, service: AuthServiceDep, file: UploadFile = File(...)
):
    """Faz upload da logo da empresa (PNG/JPG/WEBP, max 5MB)."""
    valid_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=400, detail="Formato de imagem inválido. Use PNG, JPG ou WEBP."
        )

    content = await file.read()
    if len(content) > settings.file_upload_max_size:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo muito grande. Limite de {settings.file_upload_max_size // (1024 * 1024)}MB.",
        )

    db_user = service.user_repo.get_user_by_id(user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Guardar URL antiga para limpeza depois
    old_logo_url = db_user.company_logo_url

    try:
        upload_res = await CloudinaryService.upload_file(content, str(user.id), folder="logos")
        read_url = upload_res["url"]

        db_user.company_logo_url = read_url
        service.user_repo.session.commit()
        log.info(f"🏢 Logo da empresa atualizado: {db_user.email} | URL: {read_url}")

    except Exception as e:
        service.user_repo.session.rollback()
        log.error(f"❌ Falha no upload da logo: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Falha ao processar upload no storage remoto."
        )

    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        company=db_user.company,
        company_name=db_user.company_name,
        company_segment=db_user.company_segment,
        company_description=db_user.company_description,
        avatar_url=db_user.avatar_url,
        whatsapp=db_user.whatsapp,
        company_razao_social=db_user.company_razao_social,
        company_nome_fantasia=db_user.company_nome_fantasia,
        company_cnpj=db_user.company_cnpj,
        company_address=db_user.company_address,
        company_professional_email=db_user.company_professional_email,
        company_commercial_phone=db_user.company_commercial_phone,
        company_logo_url=read_url,
        company_color_code=db_user.company_color_code,
        company_color_secondary=db_user.company_color_secondary,
    )


@router.get("/{provider}/login")
def oauth_login(provider: str):
    if provider != "google":
        raise HTTPException(status_code=400, detail="Provider inválido")

    state = OAuthStateService.create_state(provider)
    url = GoogleOAuthProvider.build_authorization_url(state)

    return {"url": url}


@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    service: AuthServiceDep,
    code: str = Query(...),
    state: str = Query(...),
):
    if not OAuthStateService.validate_state(state):
        frontend_url = settings.cors_origins.split(",")[0]
        return RedirectResponse(url=f"{frontend_url}/login?error=state_invalid")

    try:
        if provider != "google":
            raise HTTPException(status_code=400, detail="Provider inválido")

        token_data = GoogleOAuthProvider.exchange_code_for_token(code)
        user_info = GoogleOAuthProvider.fetch_user_profile(token_data["access_token"])
        email = user_info.get("email")

        if not email:
            raise ValueError("Não foi possível obter o e-mail do perfil OAuth.")

        tokens = service.authenticate_oauth_user(email=email, provider=provider)
        log.info(f"🌐 Login OAuth ({provider}) bem-sucedido: {email}")

        frontend_url = settings.cors_origins.split(",")[0]
        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?token={tokens['access_token']}&refresh_token={tokens['refresh_token']}"
        )
    except Exception as e:
        log.error(f"❌ Erro crítico no fluxo OAuth ({provider}): {str(e)}")
        frontend_url = settings.cors_origins.split(",")[0]
        error_msg = str(e).replace(" ", "_")
        return RedirectResponse(url=f"{frontend_url}/login?error={error_msg}")
