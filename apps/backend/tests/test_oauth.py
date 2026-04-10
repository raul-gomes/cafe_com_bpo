import pytest
from unittest.mock import patch, MagicMock
from src.models import User

@pytest.fixture
def mock_httpx_post():
    with patch("httpx.post") as mock_post:
        yield mock_post

@pytest.fixture
def mock_httpx_get():
    with patch("httpx.get") as mock_get:
        yield mock_get

def test_google_oauth_redirect_returns_valid_url(client):
    response = client.get("/auth/google/login")
    assert response.status_code == 200
    assert "url" in response.json()
    url = response.json()["url"]
    assert "https://accounts.google.com/o/oauth2/v2/auth" in url
    assert "state=" in url
    assert "client_id=" in url

def test_google_callback_creates_user_on_first_login(client, db_session, mock_httpx_post, mock_httpx_get):
    # Setup mock validation/token exchange
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token"}
    
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"email": "newuser@gmail.com"}

    with patch("src.oauth.OAuthStateService.validate_state", return_value=True):
        response = client.get("/auth/google/callback?code=fake_code&state=valid_state")
        
        assert response.status_code == 200
        assert "access_token" in response.json()
        
        # Check if user was created
        user = db_session.query(User).filter_by(email="newuser@gmail.com").first()
        assert user is not None
        assert user.auth_provider == "google"

def test_google_callback_logs_in_existing_user(client, db_session, mock_httpx_post, mock_httpx_get):
    user = User(email="existing@gmail.com", password_hash="dummy", auth_provider="google")
    db_session.add(user)
    db_session.commit()

    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token2"}
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"email": "existing@gmail.com"}

    with patch("src.oauth.OAuthStateService.validate_state", return_value=True):
        response = client.get("/auth/google/callback?code=abc&state=xyz")
        assert response.status_code == 200
        assert "access_token" in response.json()
        
        count = db_session.query(User).filter_by(email="existing@gmail.com").count()
        assert count == 1

def test_microsoft_callback_creates_or_reuses_user(client, db_session, mock_httpx_post, mock_httpx_get):
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token_ms"}
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"userPrincipalName": "msuser@outlook.com"} 

    with patch("src.oauth.OAuthStateService.validate_state", return_value=True):
        response = client.get("/auth/microsoft/callback?code=abc&state=xyz")
        assert response.status_code == 200
        assert "access_token" in response.json()
        
        user = db_session.query(User).filter_by(email="msuser@outlook.com").first()
        assert user is not None
        assert user.auth_provider == "microsoft"

def test_oauth_callback_rejects_invalid_state(client):
    with patch("src.oauth.OAuthStateService.validate_state", return_value=False):
        response = client.get("/auth/google/callback?code=abc&state=invalid")
        assert response.status_code == 400
        assert "state" in response.json().get("detail", "").lower()

def test_oauth_callback_handles_profile_without_email(client, mock_httpx_post, mock_httpx_get):
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token"}
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"id": "12345"} 

    with patch("src.oauth.OAuthStateService.validate_state", return_value=True):
        response = client.get("/auth/google/callback?code=abc&state=valid_state")
        assert response.status_code == 400
        assert "email" in response.json().get("detail", "").lower()
