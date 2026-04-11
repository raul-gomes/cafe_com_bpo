from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mode: str = "development"
    database_url: str
    jwt_secret: str = "7e15d862e6e66e63283f51680650965b2d718501239634e9f783efc70b86a079" # 32-byte hex
    jwt_algorithm: str = "HS256"

    # OAuth Settings
    google_client_id: str = "dummy_google_id"
    google_client_secret: str = "dummy_google_secret"
    microsoft_client_id: str = "dummy_ms_id"
    microsoft_client_secret: str = "dummy_ms_secret"
    oauth_redirect_uri: str = "http://localhost:8000/auth" # Base URI for callback

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
