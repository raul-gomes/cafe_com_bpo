import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from .models import User


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
        name: str | None = None,
        company: str | None = None,
        role: str = "user",
        terms_accepted: bool = False,
    ) -> User:
        user = User(
            email=email,
            password_hash=password_hash,
            auth_provider=auth_provider,
            name=name,
            company=company,
            role=role,
            terms_accepted=terms_accepted,
            terms_accepted_at=datetime.now(timezone.utc) if terms_accepted else None,
        )
        self.session.add(user)
        self.session.flush()
        return user

    def get_user_by_email(self, email: str) -> User | None:
        return self.session.query(User).filter(User.email == email).first()

    def get_users_by_emails(self, emails: list[str]) -> list[User]:
        normalized = [e.lower().strip() for e in emails]
        return self.session.query(User).filter(User.email.in_(normalized)).all()

    def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.session.query(User).filter(User.id == user_id).first()

    def update_user(self, user_id: uuid.UUID, **kwargs) -> User | None:
        user = self.get_user_by_id(user_id)
        if not user:
            return None
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        self.session.flush()
        return user
