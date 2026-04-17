import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from src.core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    # Forçar serialização JSON para SQLite em testes
    json_serializer=lambda obj: json.dumps(obj, default=str),
    json_deserializer=json.loads
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
