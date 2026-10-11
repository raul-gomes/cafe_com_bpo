import pytest
from pydantic import ValidationError

from src.core.config import Settings


def test_settings_load_from_environment(monkeypatch):
    monkeypatch.setenv("MODE", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/db")

    settings = Settings()
    assert settings.mode == "production"
    assert settings.database_url == "postgresql://user:pass@localhost:5432/db"


def test_settings_fail_when_required_env_is_missing(monkeypatch):
    # monkeypatch allows us to isolate this test environment variables
    # The actual environment might have DATABASE_URL from conftest, so let's delete it
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


# --- B5: o segredo do JWT não pode ser fraco (SEC-5) -----------------------
#
# `jwt_secret` era uma string qualquer: um deploy com segredo vazio ou curto
# aceita token forjado — o mesmo segredo que assina é o que valida, então
# qualquer um que o conheça vira qualquer usuário. A regra é.fail-loud: preferimos
# a aplicação não subir a subir com uma chave que não protege nada.

MIN_JWT_SECRET_LENGTH = 32


def test_short_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "segredo-curto")
    monkeypatch.setenv("MODE", "production")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_empty_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "")
    monkeypatch.setenv("MODE", "production")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_long_enough_jwt_secret_is_accepted(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "x" * MIN_JWT_SECRET_LENGTH)
    monkeypatch.setenv("MODE", "production")

    settings = Settings(_env_file=None)

    assert len(settings.jwt_secret) == MIN_JWT_SECRET_LENGTH


def test_weak_jwt_secret_is_rejected_in_development_too(monkeypatch):
    """A regra não tem exceção por ambiente: `MODE=development` em um deploy
    errado é o mesmo furo, e exempt só empurraria o problema para frente."""
    monkeypatch.setenv("JWT_SECRET", "1234")
    monkeypatch.setenv("MODE", "development")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)
