import jwt
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
import httpx
from src.config import get_settings

settings = get_settings()

class OAuthStateService:
    @staticmethod
    def create_state(provider: str) -> str:
        """Gera um JWT curto para atuar como mitigador de CSRF (state)."""
        expire = datetime.now(timezone.utc) + timedelta(minutes=5)
        payload = {"sub": "oauth_state", "provider": provider, "exp": expire}
        return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    @staticmethod
    def validate_state(state: str) -> bool:
        """Valida se o JWT state foi assinado localmente e não expirou."""
        try:
            payload = jwt.decode(state, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            return payload.get("sub") == "oauth_state"
        except jwt.PyJWTError:
            return False

class GoogleOAuthProvider:
    AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    USER_INFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
    
    @staticmethod
    def build_authorization_url(state: str) -> str:
        redirect_uri = f"{settings.oauth_redirect_uri}/google/callback"
        return (
            f"{GoogleOAuthProvider.AUTHORIZE_URL}?"
            f"client_id={settings.google_client_id}&"
            f"redirect_uri={redirect_uri}&"
            f"response_type=code&"
            f"scope=email profile&"
            f"state={state}"
        )

    @staticmethod
    def exchange_code_for_token(code: str) -> Dict[str, str]:
        data = {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"{settings.oauth_redirect_uri}/google/callback"
        }
        response = httpx.post(GoogleOAuthProvider.TOKEN_URL, data=data)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def fetch_user_profile(access_token: str) -> dict:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = httpx.get(GoogleOAuthProvider.USER_INFO_URL, headers=headers)
        response.raise_for_status()
        return response.json()

class MicrosoftOAuthProvider:
    AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
    TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    USER_INFO_URL = "https://graph.microsoft.com/v1.0/me"

    @staticmethod
    def build_authorization_url(state: str) -> str:
        redirect_uri = f"{settings.oauth_redirect_uri}/microsoft/callback"
        return (
            f"{MicrosoftOAuthProvider.AUTHORIZE_URL}?"
            f"client_id={settings.microsoft_client_id}&"
            f"response_type=code&"
            f"redirect_uri={redirect_uri}&"
            f"response_mode=query&"
            f"scope=User.Read&"
            f"state={state}"
        )

    @staticmethod
    def exchange_code_for_token(code: str) -> Dict[str, str]:
        data = {
            "client_id": settings.microsoft_client_id,
            "client_secret": settings.microsoft_client_secret,
            "code": code,
            "redirect_uri": f"{settings.oauth_redirect_uri}/microsoft/callback",
            "grant_type": "authorization_code"
        }
        response = httpx.post(MicrosoftOAuthProvider.TOKEN_URL, data=data)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def fetch_user_profile(access_token: str) -> dict:
        headers = {"Authorization": f"Bearer {access_token}"}
        response = httpx.get(MicrosoftOAuthProvider.USER_INFO_URL, headers=headers)
        response.raise_for_status()
        return response.json()
