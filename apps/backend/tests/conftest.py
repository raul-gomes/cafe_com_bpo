import pytest
import os
from fastapi.testclient import TestClient

# Set environment before loading the app/settings
os.environ["MODE"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"

# Ensure a fresh database file for each test session to avoid "no such column" errors
if os.path.exists("./test.db"):
    os.remove("./test.db")

from src.core.config import get_settings  # noqa: E402
get_settings.cache_clear()

from src.main import create_app  # noqa: E402
from src.core.database import engine, Base  # noqa: E402
# Force table creation at import time for SQLite
Base.metadata.create_all(bind=engine)

from sqlalchemy.orm import Session  # noqa: E402

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Cria todas as tabelas antes de rodar os testes."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def db_session():
    """Test database session."""
    session = Session(bind=engine)
    session.begin_nested()
    yield session
    session.rollback()
    session.close()
