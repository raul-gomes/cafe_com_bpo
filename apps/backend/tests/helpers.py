"""Utilitários compartilhados dos testes.

O endpoint público /auth/register foi removido (registro desativado):
usuários de teste são criados diretamente no banco via UserRepository.
"""

from src.core.database import SessionLocal
from src.core.security import PasswordService
from src.modules.auth.models import User
from src.modules.auth.repository import UserRepository


def create_test_user(
    email: str,
    password: str = "StrongPassword123!",
    name: str | None = "Test User",
    company: str | None = None,
    role: str = "user",
) -> User:
    """Cria usuário direto no banco e retorna a instância (email normalizado)."""
    session = SessionLocal()
    try:
        user = UserRepository(session).create_user(
            email=email.lower(),
            password_hash=PasswordService.hash_password(password),
            name=name,
            company=company,
            role=role,
            terms_accepted=True,
        )
        session.commit()
        return user
    finally:
        session.close()


def register_user(payload: dict) -> User:
    """Substituto direto de `client.post('/auth/register', json=payload)`."""
    return create_test_user(
        email=payload["email"],
        password=payload.get("password", ""),
        name=payload.get("name"),
        company=payload.get("company"),
    )
