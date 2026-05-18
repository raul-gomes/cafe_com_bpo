from typing import Optional
from sqlalchemy.orm import Session
from .models import User
import uuid


class UserRepository:
    """
    Repositório para gerenciar operações da entidade User.
    """

    def __init__(self, session: Session):
        self.session = session

    def create_user(
        self,
        email: str,
        password_hash: str,
        auth_provider: str = "local",
        name: Optional[str] = None,
        company: Optional[str] = None,
    ) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            auth_provider=auth_provider,
            name=name,
            company=company,
        )
        self.session.add(user)
        self.session.flush()
        return user

    def get_user_by_email(self, email: str) -> Optional[User]:
        return self.session.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        return self.session.query(User).filter(User.id == user_id).first()

    def update_user(self, user_id: uuid.UUID, **kwargs) -> Optional[User]:
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        self.session.flush()
        return user
