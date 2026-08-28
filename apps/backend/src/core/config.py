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

    # Resend Email Settings
    resend_api_key: str = ""
    resend_from_email: str = "onboarding@resend.dev"

    # Email Queue / Delivery Settings
    email_provider: str = "resend"  # resend | mailpit | noop
    email_max_attempts: int = 5
    email_worker_interval_seconds: int = 15
    email_reset_token_ttl_minutes: int = 30
    email_delivery_timeout_minutes: int = 10
    email_reply_to: str = ""
    mailpit_host: str = "mailpit"
    mailpit_port: int = 1025

    # Frontend URL for email links
    frontend_url: str = "http://localhost:3000"

    # Asaas Payments
    asaas_api_key: str = ""

    # Google Calendar
    google_calendar_client_id: str = ""
    google_calendar_client_secret: str = ""
    google_calendar_redirect_uri: str = "http://localhost:3000/calendar/callback"

    # Support / Feedback
    support_email: str = "cafe@cafecombpo.com.br"
    # Destinatário dedicado do "Reportar Erro" (fallback: support_email)
    feedback_email: str = ""

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
