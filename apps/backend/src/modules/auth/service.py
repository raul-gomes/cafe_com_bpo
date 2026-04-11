import uuid
from typing import Optional, Annotated
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, Depends

from src.core.database import get_db_session
from src.core.security import PasswordService, TokenService, oauth2_scheme
from .repository import UserRepository
from .schemas import UserCreate, UserResponse

class AuthService:
    def __init__(self, session: Session):
        self.user_repo = UserRepository(session)

    def register_user(self, payload: UserCreate) -> UserResponse:
        try:
            hashed_pw = PasswordService.hash_password(payload.password)
            user = self.user_repo.create_user(
                email=payload.email,
                password_hash=hashed_pw,
                name=payload.name,
                company=payload.company,
            )
            self.user_repo.session.commit()
            return UserResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                company=user.company,
            )
        except IntegrityError:
            self.user_repo.session.rollback()
            raise ValueError("Este E-mail já está em uso na base.")
        except Exception as e:
            self.user_repo.session.rollback()
            raise e
        
    def authenticate_user(self, email: str, password: str) -> Optional[str]:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            return None
        
        if not PasswordService.verify_password(password, user.password_hash):
            return None
            
        return TokenService.create_access_token(user_id=str(user.id))

    def authenticate_oauth_user(self, email: str, provider: str) -> str:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            user = self.user_repo.create_user(
                email=email,
                password_hash="oauth_login",
                auth_provider=provider
            )
            self.user_repo.session.commit()
            
        return TokenService.create_access_token(user_id=str(user.id))

def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)], 
    session: Annotated[Session, Depends(get_db_session)]
) -> UserResponse:
    try:
        payload = TokenService.decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError()
    except ValueError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    repo = UserRepository(session)
    user = repo.get_user_by_id(uuid.UUID(user_id))
    if user is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    
    return UserResponse(
        id=user.id, 
        email=user.email,
        name=user.name,
        company=user.company
    )
