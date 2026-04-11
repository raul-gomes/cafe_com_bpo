from typing import Optional
from src.schemas import UserCreate, UserResponse
from src.repositories import UserRepository
from src.config import get_settings
from passlib.context import CryptContext
from datetime import datetime, timezone, timedelta
import jwt
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordBearer
import bcrypt

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

class PasswordService:
    @staticmethod
    def hash_password(plain_password: str) -> str:
        salt = bcrypt.gensalt()
        hashed_bytes = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
        return hashed_bytes.decode('utf-8')
        
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

class TokenService:
    @staticmethod
    def create_access_token(user_id: str, subject: Optional[str] = None) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=30)
        to_encode = {"sub": user_id, "exp": expire}
        if subject:
            to_encode["subject"] = subject
        return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        
    @staticmethod
    def decode_access_token(token: str) -> dict:
        try:
            return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        except jwt.PyJWTError:
            raise ValueError("Token inválido ou expirado")

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

from typing import Annotated
from fastapi import Depends
from src.database import get_db_session
import uuid

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], session: Annotated[Session, Depends(get_db_session)]) -> UserResponse:
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
    return UserResponse(id=user.id, email=user.email)
