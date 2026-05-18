import httpx
import time
import jwt
from src.core.config import get_settings

settings = get_settings()


class OAuthStateService:
    _EXPIRATION = 600  # 10 minutos

    @classmethod
    def create_state(cls, provider: str) -> str:
        import secrets

        expire = time.time() + cls._EXPIRATION
        payload = {
            "provider": provider,
            "exp": expire,
            "jti": secrets.token_urlsafe(16),
        }
        return jwt.encode(
            payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
        )

    @classmethod
    def validate_state(cls, state: str) -> bool:
        try:
            payload = jwt.decode(
                state, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
            )
            return payload.get("provider") is not None
        except (jwt.PyJWTError, Exception):
            return False


class GoogleOAuthProvider:
    @staticmethod
    def build_authorization_url(state: str) -> str:
        base_url = settings.google_auth_url
        params = {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.oauth_redirect_uri.format(provider="google"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query}"

    @staticmethod
    def exchange_code_for_token(code: str) -> dict:
        url = settings.google_token_url
        data = {
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.oauth_redirect_uri.format(provider="google"),
            "grant_type": "authorization_code",
        }
        res = httpx.post(url, data=data)
        if res.is_error:
            raise Exception(f"Falha ao trocar código Google: {res.text}")
        return res.json()

    @staticmethod
    def fetch_user_profile(access_token: str) -> dict:
        url = settings.google_userinfo_url
        headers = {"Authorization": f"Bearer {access_token}"}
        res = httpx.get(url, headers=headers)
        if res.is_error:
            raise Exception(f"Falha ao buscar perfil Google: {res.text}")
        return res.json()
