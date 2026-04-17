import pytest
import os
import json
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import Session, sessionmaker

# 1. Configurar ambiente ANTES de qualquer import do projeto
os.environ["MODE"] = "test"
os.environ["DATABASE_URL"] = "sqlite://"

# 2. Criar engine de teste com StaticPool para persistência em memória (:memory:)
test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    json_serializer=lambda obj: json.dumps(obj, default=str),
    json_deserializer=json.loads
)

# 3. Patch IMEDIATO do src.core.database ANTES de importar o app
import src.core.database  # noqa: E402
src.core.database.engine = test_engine
src.core.database.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# 4. Agora importar o restante do projeto
from src.core.config import get_settings  # noqa: E402
from src.main import create_app  # noqa: E402
from src.core.database import Base  # noqa: E402

get_settings.cache_clear()

# 5. Criar tabelas IMEDIATAMENTE no import do conftest
Base.metadata.create_all(bind=test_engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Garante que as tabelas existam antes de qualquer teste."""
    Base.metadata.create_all(bind=test_engine)
    yield
    # No :memory: com StaticPool, o drop_all não é estritamente necessário no fim da sessão
    # mas ajuda a validar limpeza se necessário.
    # Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def client():
    """Cria um cliente de teste usando o app configurado com banco em memória."""
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def db_session():
    """Sessão de banco de dados para testes unitários."""
    session = Session(bind=test_engine)
    session.begin_nested()
    yield session
    session.rollback()
    session.close()
