from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from typing import Annotated
from src.schemas import UserCreate, UserResponse, TokenResponse
from src.auth import AuthService, get_current_user

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
        return service.register_user(user_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login", response_model=TokenResponse)
def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    service: AuthServiceDep
):
    token = service.authenticate_user(form_data.username, form_data.password)
    if not token:
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    return {"access_token": token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(user: CurrentUserDep):
    return user
