from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from .models import UserGoogleToken


class GoogleTokenRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_user_id(self, user_id: UUID) -> Optional[UserGoogleToken]:
        return (
            self.session.query(UserGoogleToken)
            .filter(UserGoogleToken.user_id == user_id)
            .first()
        )

    def upsert(
        self,
        user_id: UUID,
        access_token: str,
        refresh_token: str,
        expires_at,
        scope: str = "",
        token_type: str = "Bearer",
    ) -> UserGoogleToken:
        existing = self.get_by_user_id(user_id)
        if existing:
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.expires_at = expires_at
            existing.scope = scope
            existing.token_type = token_type
            token = existing
        else:
            token = UserGoogleToken(
                user_id=user_id,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=expires_at,
                scope=scope,
                token_type=token_type,
            )
            self.session.add(token)
        self.session.commit()
        self.session.refresh(token)
        return token

    def delete_by_user_id(self, user_id: UUID) -> bool:
        token = self.get_by_user_id(user_id)
        if token:
            self.session.delete(token)
            self.session.commit()
            return True
        return False
