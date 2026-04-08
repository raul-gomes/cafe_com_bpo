from typing import Optional
from src.schemas import UserCreate, UserResponse

class PasswordService:
    @staticmethod
    def hash_password(plain_password: str) -> str:
        raise NotImplementedError()
        
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        raise NotImplementedError()

class TokenService:
    @staticmethod
    def create_access_token(user_id: str, subject: Optional[str] = None) -> str:
        raise NotImplementedError()
        
    @staticmethod
    def decode_access_token(token: str) -> dict:
        raise NotImplementedError()

class AuthService:
    def register_user(self, payload: UserCreate) -> UserResponse:
        raise NotImplementedError()
        
    def authenticate_user(self, email: str, password: str) -> Optional[str]:
        raise NotImplementedError()

from fastapi import HTTPException

def get_current_user():
    # Stub for FastAPI Dependency Injection
    raise HTTPException(status_code=501, detail="Pendente Fase Verde")
