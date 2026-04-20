from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from sqlalchemy.orm import Session
import os
import shutil
import uuid

from src.core.database import get_db_session
from src.core.logger import log
from .schemas import UserCreate, UserResponse, TokenResponse
from .service import AuthService, get_current_user
from .oauth.service import OAuthStateService, GoogleOAuthProvider, MicrosoftOAuthProvider

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service(session: Annotated[Session, Depends(get_db_session)]) -> AuthService:
    return AuthService(session)

AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]

@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    user_data: UserCreate,
    service: AuthServiceDep
):
    try:
        new_user = service.register_user(user_data)
        log.info(f"💾 Novo usuário registrado: {user_data.email} | Empresa: {user_data.company or 'N/A'}")
        return new_user
    except ValueError as e:
        log.warning(f"⚠️ Falha de validação no registro ({user_data.email}): {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    service: AuthServiceDep
):
    token = service.authenticate_user(form_data.username, form_data.password)
    if not token:
        log.warning(f"🚫 Tentativa de login inválida: {form_data.username}")
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    log.info(f"🔑 Usuário logado com sucesso: {form_data.username}")
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(user: CurrentUserDep):
    return user

from .models import User, UserFile
from .storage_service import OneDriveService
from src.core.config import get_settings

settings = get_settings()

@router.post("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    user: CurrentUserDep,
    service: AuthServiceDep,
    file: UploadFile = File(...)
):
    # 1. Validação de Formato
    valid_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in valid_extensions:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use PNG, JPG ou WEBP.")
    
    # 2. Validação de Tamanho
    content = await file.read()
    if len(content) > settings.file_upload_max_size:
        raise HTTPException(status_code=413, detail=f"Arquivo muito grande. Limite de {settings.file_upload_max_size // (1024*1024)}MB.")

    # 3. Criar registro pendente no banco
    db_user = service.user_repo.get_user_by_id(user.id)
    if not db_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    new_file_record = UserFile(
        user_id=db_user.id,
        category="avatar",
        provider="onedrive",
        status="pending",
        mime_type=file.content_type or "image/png",
        size_bytes=len(content),
        original_file_name=file.filename or "avatar.png"
    )
    service.user_repo.session.add(new_file_record)
    service.user_repo.session.flush() # Gerar ID

    old_avatar_file = db_user.avatar_file

    try:
        # 4. Upload para OneDrive
        upload_res = await OneDriveService.upload_file(content, str(user.id), ext)
        item_id = upload_res["id"]
        
        # 5. Gerar Link de Compartilhamento
        read_url = await OneDriveService.create_sharing_link(item_id)
        
        # 6. Atualizar registro para Ativo
        new_file_record.provider_item_id = item_id
        new_file_record.read_url = read_url
        new_file_record.status = "active"
        
        db_user.avatar_file_id = new_file_record.id
        db_user.avatar_url = read_url # Fallback para compatibilidade
        
        service.user_repo.session.commit()
        log.info(f"🖼️ Avatar OneDrive ativo: {db_user.email} | URL: {read_url}")
        
        # 7. Cleanup assíncrono do avatar antigo
        if old_avatar_file and old_avatar_file.provider_item_id:
            await OneDriveService.delete_file(old_avatar_file.provider_item_id)
            old_avatar_file.status = "deleted"
            service.user_repo.session.commit()

    except Exception as e:
        service.user_repo.session.rollback()
        new_file_record.status = "failed"
        service.user_repo.session.add(new_file_record) # Tentar salvar falha para reconciliação
        service.user_repo.session.commit()
        log.error(f"❌ Falha no upload OneDrive: {str(e)}")
        raise HTTPException(status_code=500, detail="Falha ao processar upload no storage remoto.")

    return UserResponse(
        id=db_user.id,
        email=db_user.email,
        name=db_user.name,
        company=db_user.company,
        avatar_url=read_url
    )

@router.get("/{provider}/login")
def oauth_login(provider: str):
    if provider not in ["google", "microsoft"]:
        raise HTTPException(status_code=400, detail="Provider inválido")
    
    state = OAuthStateService.create_state(provider)
    if provider == "google":
        url = GoogleOAuthProvider.build_authorization_url(state)
    else:
        url = MicrosoftOAuthProvider.build_authorization_url(state)
        
    return {"url": url}

@router.get("/{provider}/callback")
def oauth_callback(
    provider: str,
    service: AuthServiceDep,
    code: str = Query(...),
    state: str = Query(...)
):
    if not OAuthStateService.validate_state(state):
        raise HTTPException(status_code=400, detail="State inválido ou expirado")

    try:
        if provider == "google":
            token_data = GoogleOAuthProvider.exchange_code_for_token(code)
            user_info = GoogleOAuthProvider.fetch_user_profile(token_data["access_token"])
            email = user_info.get("email")
        elif provider == "microsoft":
            token_data = MicrosoftOAuthProvider.exchange_code_for_token(code)
            user_info = MicrosoftOAuthProvider.fetch_user_profile(token_data["access_token"])
            email = user_info.get("userPrincipalName") or user_info.get("mail")
        else:
            raise HTTPException(status_code=400, detail="Provider inválido")
            
        if not email:
            raise ValueError("Não foi possível obter o e-mail do perfil OAuth.")
            
        token = service.authenticate_oauth_user(email=email, provider=provider)
        log.info(f"🌐 Login OAuth ({provider}) bem-sucedido: {email}")
        return {"access_token": token, "token_type": "bearer"}
    except Exception as e:
        log.error(f"❌ Erro crítico no fluxo OAuth ({provider}): {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
