import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

import jwt

from tests.helpers import register_user


def test_login_with_correct_credentials(client):
    """Phase 1.4: Test login with correct credentials"""
    email = f"login_test_{uuid4()}@cafe.com"
    password = "StrongPassword123!"

    # Register user
    register_user(payload={"email": email, "password": password})

    # Login with correct credentials
    response = client.post(
        "/auth/login", data={"username": email, "password": password}
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    # refresh_token now set as httpOnly cookie, not in body
    assert "refresh_token" in response.cookies
    assert response.cookies["refresh_token"]


def test_login_with_incorrect_credentials(client):
    """Phase 1.4: Test login with incorrect credentials"""
    email = f"login_fail_{uuid4()}@cafe.com"
    password = "StrongPassword123!"

    # Register user
    register_user(payload={"email": email, "password": password})

    # Login with wrong password
    response = client.post(
        "/auth/login", data={"username": email, "password": "WrongPassword!"}
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais inválidas"


def test_token_refresh_flow(client):
    """Phase 1.5: Test token refresh flow"""
    email = f"refresh_test_{uuid4()}@cafe.com"
    password = "StrongPassword123!"

    # Register and login
    register_user(payload={"email": email, "password": password})
    login_response = client.post(
        "/auth/login", data={"username": email, "password": password}
    )

    # refresh_token is set as httpOnly cookie — extract it
    refresh_token = login_response.cookies.get("refresh_token")
    assert refresh_token, "No refresh_token cookie set"

    # Use refresh token to get new access token
    client.cookies.set("refresh_token", refresh_token)
    response = client.post("/auth/refresh", json={})

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_expired_token_rejection(client):
    """Phase 1.5: Test expired token rejection on protected routes"""
    from src.core.config import get_settings

    settings = get_settings()

    # Create an expired token
    expire = datetime.now(timezone.utc) - timedelta(hours=1)
    expired_payload = {"sub": str(uuid4()), "exp": expire, "type": "access"}
    expired_token = jwt.encode(
        expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )

    response = client.get(
        "/auth/me", headers={"Authorization": f"Bearer {expired_token}"}
    )

    assert response.status_code == 401


def test_forgot_password_token_generation(client):
    """Phase 1.3: Test backend token generation for forgot password"""
    email = f"forgot_{uuid4()}@cafe.com"

    # Register user
    register_user(payload={"email": email, "password": "StrongPassword123!"})

    # Request password reset
    with patch("src.core.email.EmailService.send_reset_password_email") as mock_send:
        response = client.post("/auth/forgot-password", json={"email": email})

        assert response.status_code == 200
        assert "e-mail estiver cadastrado" in response.json()["message"]
        mock_send.assert_called_once()


def test_forgot_password_nonexistent_email_response_is_generic(client):
    """Phase 1.3: Nonexistent email must not reveal account existence"""

    with patch("src.core.email.EmailService.send_reset_password_email") as mock_send:
        response = client.post(
            "/auth/forgot-password", json={"email": "nonexistent@cafe.com"}
        )

        assert response.status_code == 200
        assert "e-mail estiver cadastrado" in response.json()["message"]
        assert not mock_send.called


def test_forgot_password_token_stored_as_hash(client):
    """Phase 1.3: The reset token is never stored in plaintext (only SHA-256)."""
    from src.core.database import SessionLocal
    from src.modules.auth.models import PasswordResetToken, User
    from src.modules.auth.service import AuthService

    email = f"hash_test_{uuid4()}@cafe.com"
    register_user(payload={"email": email, "password": "StrongPassword123!"})

    session = SessionLocal()
    user = session.query(User).filter_by(email=email).first()

    token = AuthService(session).create_reset_token(email)
    stored = (
        session.query(PasswordResetToken).filter_by(user_id=user.id, used=False).one()
    )

    # stored token is the sha256 hash, not the plaintext
    assert stored.token == hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert len(stored.token) == 64
    int(stored.token, 16)  # raises if not hex

    # plaintext token never appears in the database
    plaintext_rows = (
        session.query(PasswordResetToken)
        .filter(PasswordResetToken.token == token)
        .count()
    )
    assert plaintext_rows == 0
    session.close()


def test_reset_password_token_validation(client):
    """Phase 1.3: Test token validation and expiry"""
    email = f"reset_test_{uuid4()}@cafe.com"

    # Register user
    register_user(payload={"email": email, "password": "StrongPassword123!"})

    # Request password reset to generate token
    with patch("src.core.email.EmailService.send_reset_password_email"):
        reset_response = client.post("/auth/forgot-password", json={"email": email})
        assert reset_response.status_code == 200

    # Get the token from the database
    from src.core.database import SessionLocal
    from src.modules.auth.models import User
    from src.modules.auth.service import AuthService

    session = SessionLocal()
    user = session.query(User).filter_by(email=email).first()
    assert user is not None

    service = AuthService(session)
    token = service.create_reset_token(email)
    session.close()

    assert token is not None

    # Test valid token
    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewStrongPassword123!"},
    )

    assert response.status_code == 200
    assert "redefinida com sucesso" in response.json()["message"]


def test_reset_password_expired_token(client):
    """Phase 1.3: Test expired token rejection"""
    email = f"expired_test_{uuid4()}@cafe.com"

    # Register user
    register_user(payload={"email": email, "password": "StrongPassword123!"})

    # Get user and create expired token directly
    import secrets

    from src.core.database import SessionLocal
    from src.modules.auth.models import PasswordResetToken, User

    session = SessionLocal()
    user = session.query(User).filter_by(email=email).first()
    assert user is not None

    # Create an expired token (stored as sha256, like the service does)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=hashlib.sha256(token.encode("utf-8")).hexdigest(),
        expires_at=expires_at,
    )
    session.add(reset_token)
    session.commit()
    session.close()

    # Test expired token
    response = client.post(
        "/auth/reset-password",
        json={"token": token, "new_password": "NewStrongPassword123!"},
    )

    assert response.status_code == 400
    assert "inválido ou expirado" in response.json()["detail"]


def test_reset_password_invalid_token(client):
    """Phase 1.3: Test invalid token rejection"""
    response = client.post(
        "/auth/reset-password",
        json={"token": "invalid_token_123", "new_password": "NewStrongPassword123!"},
    )

    assert response.status_code == 400
    assert "inválido ou expirado" in response.json()["detail"]


def test_redirect_behavior_on_401(client):
    """Phase 1.5: Test redirect behavior on 401 responses"""
    # Test that accessing protected route without token returns 401
    response = client.get("/auth/me")
    assert response.status_code == 401

    # Test with invalid token
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalid_token"})
    assert response.status_code == 401
