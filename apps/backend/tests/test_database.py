from alembic.config import Config
from alembic import command
from sqlalchemy import inspect, text
from src.core.database import engine

def test_alembic_upgrade_applies_schema_successfully():
    """
    Testa se as migrations do banco passam sem erro (Alembic).

    Alembic upgrade head e valida se as tabelas fundamentais foram inicializadas.
    """
    # Clean up any existing tables before running migrations to avoid "table already exists" error or conflicts
    with engine.connect() as connection:
        with connection.begin():
            inspector = inspect(engine)
            existing_tables = inspector.get_table_names()
            # Disable FK checks temporarily for SQLite cleanup if needed, 
            # but simple DROP TABLE IF EXISTS is usually enough for test isolation
            for table in existing_tables:
                connection.execute(text(f"DROP TABLE IF EXISTS {table}"))
    
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")

    inspector = inspect(engine)
    tables = inspector.get_table_names()

    assert "users" in tables
    assert "pricing_scenarios" in tables
