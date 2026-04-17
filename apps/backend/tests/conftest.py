import pytest
import os
from fastapi.testclient import TestClient

# Set environment before loading the app/settings
os.environ["MODE"] = "test"
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "postgresql+psycopg://postgres:postgres_password@localhost:5432/cafe_bpo"

from src.core.config import get_settings  # noqa: E402
get_settings.cache_clear()

from src.main import create_app  # noqa: E402
from src.core.database import engine, Base  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

@pytest.fixture
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def db_session():
    """Test veritabanı oturumu oluştur."""
    Base.metadata.create_all(bind=engine)
    session = Session(bind=engine)
    session.begin_nested()
    yield session
    session.rollback()
    session.close()
