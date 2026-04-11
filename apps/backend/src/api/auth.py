from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from src.schemas import UserCreate, UserResponse, TokenResponse
from src.auth import AuthService, get_current_user
from src.logger_config import log

from sqlalchemy.orm import Session
from src.database import get_db_session

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

from src.oauth import OAuthStateService, GoogleOAuthProvider, MicrosoftOAuthProvider
from fastapi import Query

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
