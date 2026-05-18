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
    oauth_redirect_uri: str

    # OAuth Provider URLs
    google_auth_url: str
    google_token_url: str
    google_userinfo_url: str

    # Cloudinary Settings
    cloudinary_cloud_name: str
    cloudinary_api_key: str
    cloudinary_api_secret: str

    file_upload_max_size: int = 5242880

    # SMTP / Email Settings
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    # Frontend URL for email links
    frontend_url: str = "http://localhost:3000"

    # Asaas Payments
    asaas_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
