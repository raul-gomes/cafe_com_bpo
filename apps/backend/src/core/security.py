from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt
import bcrypt
from fastapi.security import OAuth2PasswordBearer
from src.core.config import get_settings

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
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except (ValueError, TypeError):
            return False

class TokenService:
    @staticmethod
    def create_access_token(user_id: str, subject: Optional[str] = None) -> str:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
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
