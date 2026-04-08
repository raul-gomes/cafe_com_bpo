from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from src.schemas import UserCreate, UserResponse, TokenResponse
from src.auth import AuthService, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service() -> AuthService:
    return AuthService()

AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
CurrentUserDep = Annotated[UserResponse, Depends(get_current_user)]

@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    user_data: UserCreate,
    service: AuthServiceDep
):
    try:
        return service.register_user(user_data)
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Pendente Fase Verde")

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    service: AuthServiceDep
):
    try:
        token = service.authenticate_user(form_data.username, form_data.password)
        if not token:
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
        return {"access_token": token, "token_type": "bearer"}
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Pendente Fase Verde")

@router.get("/me", response_model=UserResponse)
def get_me(user: CurrentUserDep):
    try:
        return user
    except NotImplementedError:
        raise HTTPException(status_code=501, detail="Pendente Fase Verde")
