from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mode: str = "development"
    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    access_token_expire_minutes: int = 30
    cors_origins: str = "http://localhost:3000"

    # OAuth Settings
    google_client_id: str
    google_client_secret: str
    microsoft_client_id: str
    microsoft_client_secret: str
    oauth_redirect_uri: str
    
    # OAuth Provider URLs
    google_auth_url: str
    google_token_url: str
    google_userinfo_url: str
    microsoft_auth_url: str
    microsoft_token_url: str
    microsoft_userinfo_url: str
    
    # OneDrive & Upload Settings
    microsoft_tenant_id: str
    microsoft_storage_account_id: str
    file_upload_max_size: int = 5242880

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
