import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Annotated
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, Depends

from src.core.database import get_db_session
from src.core.security import PasswordService, TokenService, oauth2_scheme
from .repository import UserRepository
from .schemas import UserCreate, UserResponse
from .models import PasswordResetToken

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
                avatar_url=user.avatar_file.read_url if user.avatar_file else user.avatar_url
            )
        except IntegrityError:
            self.user_repo.session.rollback()
            raise ValueError("Este E-mail já está em uso na base.")
        except Exception as e:
            self.user_repo.session.rollback()
            raise e
        
    def authenticate_user(self, email: str, password: str) -> Optional[dict]:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            return None
        
        if not PasswordService.verify_password(password, user.password_hash):
            return None
            
        return {
            "access_token": TokenService.create_access_token(user_id=str(user.id)),
            "refresh_token": TokenService.create_refresh_token(user_id=str(user.id)),
        }
    
    def get_user_profile(self, user_id: uuid.UUID) -> Optional[UserResponse]:
        user = self.user_repo.get_user_by_id(user_id)
        if not user:
            return None
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            company=user.company,
            company_name=user.company_name,
            company_segment=user.company_segment,
            company_description=user.company_description,
            avatar_url=user.avatar_file.read_url if user.avatar_file else user.avatar_url
        )
    
    def update_user_profile(self, user_id: uuid.UUID, **kwargs) -> Optional[UserResponse]:
        user = self.user_repo.update_user(user_id, **kwargs)
        if not user:
            return None
        self.user_repo.session.commit()
        return UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            company=user.company,
            company_name=user.company_name,
            company_segment=user.company_segment,
            company_description=user.company_description,
            avatar_url=user.avatar_file.read_url if user.avatar_file else user.avatar_url
        )

    def authenticate_oauth_user(self, email: str, provider: str) -> dict:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            user = self.user_repo.create_user(
                email=email,
                password_hash="oauth_login",
                auth_provider=provider
            )
            self.user_repo.session.commit()
            
        return {
            "access_token": TokenService.create_access_token(user_id=str(user.id)),
            "refresh_token": TokenService.create_refresh_token(user_id=str(user.id)),
        }

    def refresh_access_token(self, refresh_token: str) -> dict:
        payload = TokenService.decode_refresh_token(refresh_token)
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Token inválido")
        
        user = self.user_repo.get_user_by_id(uuid.UUID(user_id))
        if not user:
            raise ValueError("Usuário não encontrado")
        
        return {
            "access_token": TokenService.create_access_token(user_id=str(user.id)),
            "refresh_token": TokenService.create_refresh_token(user_id=str(user.id)),
        }

    def create_reset_token(self, email: str) -> str:
        user = self.user_repo.get_user_by_email(email)
        if not user:
            return None

        self.user_repo.session.query(PasswordResetToken).filter_by(
            user_id=user.id, used=False
        ).update({"used": True})

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
        )
        self.user_repo.session.add(reset_token)
        self.user_repo.session.commit()

        return token

    def reset_password(self, token: str, new_password: str) -> bool:
        reset_token = self.user_repo.session.query(PasswordResetToken).filter_by(
            token=token, used=False
        ).first()

        if not reset_token:
            return False

        # Ensure both datetimes are offset-aware
        expires_at = reset_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if expires_at < datetime.now(timezone.utc):
            return False

        user = self.user_repo.get_user_by_id(reset_token.user_id)
        if not user:
            return False

        hashed_pw = PasswordService.hash_password(new_password)
        user.password_hash = hashed_pw
        reset_token.used = True
        self.user_repo.session.commit()

        return True

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
        company=user.company,
        company_name=user.company_name,
        company_segment=user.company_segment,
        company_description=user.company_description,
        avatar_url=user.avatar_file.read_url if user.avatar_file else user.avatar_url
    )
