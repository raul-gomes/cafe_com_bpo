import httpx
import time
from typing import Optional, Dict
from src.core.config import get_settings

settings = get_settings()

class OAuthStateService:
    _states: Dict[str, float] = {}
    _EXPIRATION = 600  # 10 minutos

    @classmethod
    def create_state(cls, provider: str) -> str:
        import secrets
        state = secrets.token_urlsafe(32)
        cls._states[state] = time.time()
        return state

    @classmethod
    def validate_state(cls, state: str) -> bool:
        if state not in cls._states:
            return False
            
        timestamp = cls._states.pop(state)
        if time.time() - timestamp > cls._EXPIRATION:
            return False
            
        return True

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
            "prompt": "select_account"
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

class MicrosoftOAuthProvider:
    @staticmethod
    def build_authorization_url(state: str) -> str:
        base_url = settings.microsoft_auth_url
        params = {
            "client_id": settings.microsoft_client_id,
            "response_type": "code",
            "redirect_uri": settings.oauth_redirect_uri.format(provider="microsoft"),
            "response_mode": "query",
            "scope": "openid profile email User.Read",
            "state": state,
        }
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query}"

    @staticmethod
    def exchange_code_for_token(code: str) -> dict:
        url = settings.microsoft_token_url
        data = {
            "client_id": settings.microsoft_client_id,
            "scope": "openid profile email User.Read",
            "code": code,
            "redirect_uri": settings.oauth_redirect_uri.format(provider="microsoft"),
            "grant_type": "authorization_code",
            "client_secret": settings.microsoft_client_secret,
        }
        res = httpx.post(url, data=data)
        if res.is_error:
            raise Exception(f"Falha ao trocar código Microsoft: {res.text}")
        return res.json()

    @staticmethod
    def fetch_user_profile(access_token: str) -> dict:
        url = settings.microsoft_userinfo_url
        headers = {"Authorization": f"Bearer {access_token}"}
        res = httpx.get(url, headers=headers)
        if res.is_error:
            raise Exception(f"Falha ao buscar perfil Microsoft: {res.text}")
        return res.json()
