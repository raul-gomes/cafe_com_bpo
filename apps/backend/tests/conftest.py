import pytest
import os
from fastapi.testclient import TestClient

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session
from src.core.database import Base

# Set environment before loading the app/settings
os.environ["MODE"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"

from src.core.config import get_settings  # noqa: E402
get_settings.cache_clear()

from src.main import create_app  # noqa: E402
from src.core.database import engine as db_engine  # noqa: E402

import json
# O motor de banco de dados original deve ser reconfigurado para usar :memory: e StaticPool nos testes
# para que o esquema persista enquanto a sessão estiver ativa.
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    json_serializer=lambda obj: json.dumps(obj, default=str),
    json_deserializer=json.loads
)
# Monkey patch o motor de banco de dados e SessionLocal para os testes
import src.core.database
src.core.database.engine = test_engine

from sqlalchemy.orm import sessionmaker
src.core.database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Force table creation at import time for SQLite
Base.metadata.create_all(bind=test_engine)

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
