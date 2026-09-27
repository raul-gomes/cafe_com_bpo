"""Utilitários compartilhados dos testes.

O endpoint público /auth/register foi removido (registro desativado):
usuários de teste são criados diretamente no banco via UserRepository.
"""

from datetime import datetime, timezone
from unittest import mock

from src.core.database import SessionLocal
from src.core.security import PasswordService
from src.modules.auth.models import User
from src.modules.auth.repository import UserRepository
from src.modules.task_manager.assignments import service as assignments_service


def freeze_assignments_clock(weekday: datetime | None = None):
    """Congela o relógio da geração inicial de tasks num dia útil fixo.

    O `POST /tasks/client-templates/` gera os primeiros cards usando
    `datetime.now()` real (assignments/service.py `_generate_for_activities`).
    Rotinas "daily" só criam cards em dias úteis (`weekday() < 5`), então a
    geração falhava nos fins de semana — o resultado variava conforme o dia em
    que o CI rodava. Congelar numa segunda-feira (default) torna os testes
    determinísticos independentemente da data de execução.
    """
    fixed = weekday or datetime(2026, 7, 20, 12, 0, 0, tzinfo=timezone.utc)

    class _FixedClock(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed if tz is None else fixed.astimezone(tz)

    return mock.patch.object(assignments_service, "datetime", _FixedClock)


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
