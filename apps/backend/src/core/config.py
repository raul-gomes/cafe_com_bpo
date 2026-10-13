from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_JWT_SECRET_LENGTH = 32


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
    # Public base URL of this API. Used for files saved on local disk when
    # Cloudinary is not configured (development only).
    public_api_url: str = "http://localhost:8000"

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
    # Signing secret do webhook do Resend (Svix). Vazio = webhook recusado:
    # sem segredo não há como distinguir o provedor de qualquer POST.
    resend_webhook_secret: str = ""

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
    # `asaas_base_url` por ambiente: `https://api.asaas.com/api/v3` em produção e
    # `https://sandbox.asaas.com/api/v3` em teste. O cliente falha alto se
    # produção apontar para sandbox (pagamento real nunca é testado em sandbox).
    asaas_api_key: str = ""
    asaas_base_url: str = "https://sandbox.asaas.com/api/v3"
    # Token compartilhado do webhook do Asaas (header `asaas-access-token`).
    # Vazio = webhook recusado: sem token configurado a rota não aceita ninguém,
    # porque "aceitar quando não há segredo" é exatamente o furo corrigido aqui.
    asaas_webhook_token: str = ""

    # Google Calendar
    google_calendar_client_id: str = ""
    google_calendar_client_secret: str = ""
    google_calendar_redirect_uri: str = "http://localhost:3000/calendar/callback"

    # Support / Feedback
    support_email: str = "falarcom@cafecombpo.com"
    # Destinatário dedicado do "Reportar Erro" (fallback: support_email)
    feedback_email: str = ""

    @field_validator("jwt_secret")
    @classmethod
    def _jwt_secret_must_be_long(cls, value: str) -> str:
        """Rejects a JWT secret too short to be a secret.

        The same value signs and validates the token, so a weak or empty secret
        makes every token forgeable. Failing at boot is the point: a deployment
        that starts with an unusable secret must not look healthy.

        Args:
            value: The configured secret.

        Returns:
            The validated secret.

        Raises:
            ValueError: When the secret is shorter than the minimum length.
        """
        if len(value) < MIN_JWT_SECRET_LENGTH:
            raise ValueError(
                "JWT_SECRET precisa de ao menos "
                f"{MIN_JWT_SECRET_LENGTH} caracteres (tem {len(value)}). "
                "Um segredo curto torna qualquer token forjável."
            )
        return value

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
