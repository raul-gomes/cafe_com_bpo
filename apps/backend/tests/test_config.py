import os
import pytest
from src.config import Settings
from pydantic import ValidationError

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
        Settings()
