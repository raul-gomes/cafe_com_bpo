from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
from src.core.config import get_settings
from src.core.logger import log

settings = get_settings()


def is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


pool_args = {}
if not is_sqlite(settings.database_url):
    pool_args = {
        "poolclass": QueuePool,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_pre_ping": True,
        "pool_recycle": 3600,
    }

engine = create_engine(settings.database_url, **pool_args)

if not is_sqlite(settings.database_url):

    @event.listens_for(engine, "connect")
    def set_postgresql_config(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("SET statement_timeout = '30s'")
        cursor.close()
        log.info("🔌 PostgreSQL connection pool configured")


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
