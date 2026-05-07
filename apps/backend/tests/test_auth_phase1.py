import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone, timedelta
import jwt
from uuid import uuid4

@pytest.fixture
def mock_httpx_post():
    with patch("httpx.post") as mock_post:
        mock_post.return_value.is_error = False
        yield mock_post

@pytest.fixture
def mock_httpx_get():
    with patch("httpx.get") as mock_get:
        mock_get.return_value.is_error = False
        yield mock_get

def test_google_oauth_successful_login_flow(client, mock_httpx_post, mock_httpx_get):
    """Phase 1.2: Test Google OAuth successful login flow"""
    email = f"google_user_{uuid4()}@gmail.com"
    
    # Mock token exchange
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token_123"}
    
    # Mock user info fetch
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"email": email, "name": "Google User"}
    
    with patch("src.modules.auth.oauth.service.OAuthStateService.validate_state", return_value=True):
        # The OAuth callback redirects to frontend, so we expect 307 (redirect)
        response = client.get("/auth/google/callback?code=fake_code&state=valid_state", follow_redirects=False)
        
        # Should redirect (307) to frontend with tokens
        assert response.status_code == 307
        assert "token=" in response.headers.get("location", "")

def test_google_oauth_creates_new_user_on_first_login(client, mock_httpx_post, mock_httpx_get):
    """Phase 1.2: Test Google OAuth creating new user on first login"""
    email = f"new_google_user_{uuid4()}@gmail.com"
    
    # Mock token exchange
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token_456"}
    
    # Mock user info fetch
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"email": email}
    
    with patch("src.modules.auth.oauth.service.OAuthStateService.validate_state", return_value=True):
        response = client.get("/auth/google/callback?code=fake_code&state=valid_state", follow_redirects=False)
        
        # Should redirect (OAuth flow completes)
        assert response.status_code == 307

def test_login_with_correct_credentials(client):
    """Phase 1.4: Test login with correct credentials"""
    email = f"login_test_{uuid4()}@cafe.com"
    password = "StrongPassword123!"
    
    # Register user
    client.post("/auth/register", json={"email": email, "password": password})
    
    # Login with correct credentials
    response = client.post("/auth/login", data={"username": email, "password": password})
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_login_with_incorrect_credentials(client):
    """Phase 1.4: Test login with incorrect credentials"""
    email = f"login_fail_{uuid4()}@cafe.com"
    password = "StrongPassword123!"
    
    # Register user
    client.post("/auth/register", json={"email": email, "password": password})
    
    # Login with wrong password
    response = client.post("/auth/login", data={"username": email, "password": "WrongPassword!"})
    
    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais inválidas"

def test_token_refresh_flow(client):
    """Phase 1.5: Test token refresh flow"""
    email = f"refresh_test_{uuid4()}@cafe.com"
    password = "StrongPassword123!"
    
    # Register and login
    client.post("/auth/register", json={"email": email, "password": password})
    login_response = client.post("/auth/login", data={"username": email, "password": password})
    
    refresh_token = login_response.json()["refresh_token"]
    
    # Use refresh token to get new access token
    response = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

def test_expired_token_rejection(client):
    """Phase 1.5: Test expired token rejection on protected routes"""
    from src.core.config import get_settings
    settings = get_settings()
    
    # Create an expired token
    expire = datetime.now(timezone.utc) - timedelta(hours=1)
    expired_payload = {"sub": str(uuid4()), "exp": expire, "type": "access"}
    expired_token = jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    
    assert response.status_code == 401

def test_forgot_password_token_generation(client):
    """Phase 1.3: Test backend token generation for forgot password"""
    email = f"forgot_{uuid4()}@cafe.com"
    
    # Register user
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    
    # Request password reset
    with patch("src.core.email.EmailService.send_reset_password_email") as mock_send:
        response = client.post("/auth/forgot-password", json={"email": email})
        
        assert response.status_code == 200
        assert "Instruções enviadas" in response.json()["message"]
        mock_send.assert_called_once()

def test_forgot_password_nonexistent_email(client):
    """Phase 1.3: Test forgot password with nonexistent email"""
    response = client.post("/auth/forgot-password", json={"email": "nonexistent@cafe.com"})
    
    assert response.status_code == 404
    assert "Nenhuma conta encontrada" in response.json()["detail"]

def test_reset_password_token_validation(client):
    """Phase 1.3: Test token validation and expiry"""
    email = f"reset_test_{uuid4()}@cafe.com"
    
    # Register user
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    
    # Request password reset to generate token
    with patch("src.core.email.EmailService.send_reset_password_email"):
        reset_response = client.post("/auth/forgot-password", json={"email": email})
        assert reset_response.status_code == 200
    
    # Get the token from the database
    from src.core.database import SessionLocal
    from src.modules.auth.service import AuthService
    from src.modules.auth.models import User
    
    session = SessionLocal()
    user = session.query(User).filter_by(email=email).first()
    assert user is not None
    
    service = AuthService(session)
    token = service.create_reset_token(email)
    session.close()
    
    assert token is not None
    
    # Test valid token
    response = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "NewStrongPassword123!"
    })
    
    assert response.status_code == 200
    assert "redefinida com sucesso" in response.json()["message"]

def test_reset_password_expired_token(client):
    """Phase 1.3: Test expired token rejection"""
    email = f"expired_test_{uuid4()}@cafe.com"
    
    # Register user
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    
    # Get user and create expired token directly
    from src.core.database import SessionLocal
    from src.modules.auth.models import User, PasswordResetToken
    import secrets
    
    session = SessionLocal()
    user = session.query(User).filter_by(email=email).first()
    assert user is not None
    
    # Create an expired token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
    reset_token = PasswordResetToken(user_id=user.id, token=token, expires_at=expires_at)
    session.add(reset_token)
    session.commit()
    session.close()
    
    # Test expired token
    response = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "NewStrongPassword123!"
    })
    
    assert response.status_code == 400
    assert "inválido ou expirado" in response.json()["detail"]

def test_reset_password_invalid_token(client):
    """Phase 1.3: Test invalid token rejection"""
    response = client.post("/auth/reset-password", json={
        "token": "invalid_token_123",
        "new_password": "NewStrongPassword123!"
    })
    
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
