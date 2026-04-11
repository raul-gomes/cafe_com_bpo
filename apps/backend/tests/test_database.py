from alembic.config import Config
from alembic import command
from sqlalchemy import inspect
from src.core.database import engine

def test_alembic_upgrade_applies_schema_successfully():
    """
    Testa se as migrations do banco passam sem erro (Alembic).

    Alembic upgrade head e valida se as tabelas fundamentais foram inicializadas.
    """
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    assert "users" in tables
    assert "pricing_scenarios" in tables
