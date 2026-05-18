import pytest
from unittest.mock import patch
from src.modules.auth.models import User
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


def test_google_oauth_redirect_returns_valid_url(client):
    response = client.get("/auth/google/login")
    assert response.status_code == 200
    assert "url" in response.json()
    url = response.json()["url"]
    assert "https://accounts.google.com/o/oauth2/v2/auth" in url
    assert "state=" in url
    assert "client_id=" in url


def test_google_callback_creates_user_on_first_login(
    client, db_session, mock_httpx_post, mock_httpx_get
):
    """
    OAuth callback returns a RedirectResponse (307) to the frontend.
    We validate the redirect contains the token and that the user was created.
    """
    email = f"newuser_{uuid4()}@gmail.com"
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token"}

    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"email": email}

    with patch(
        "src.modules.auth.oauth.service.OAuthStateService.validate_state",
        return_value=True,
    ):
        # Don't follow redirects to inspect the 307 response
        response = client.get(
            "/auth/google/callback?code=fake_code&state=valid_state",
            follow_redirects=False,
        )

        # It should redirect to frontend with tokens
        assert response.status_code == 307
        location = response.headers.get("location", "")
        assert "/auth/callback?token=" in location, f"Unexpected redirect: {location}"
        assert "refresh_token=" in location

        # Check if user was created in the database
        user = db_session.query(User).filter_by(email=email).first()
        assert user is not None
        assert user.auth_provider == "google"


def test_google_callback_logs_in_existing_user(
    client, db_session, mock_httpx_post, mock_httpx_get
):
    """
    OAuth callback redirects to frontend with tokens.
    User should still exist only once after login.
    """
    email = f"existing_{uuid4()}@gmail.com"
    user = User(email=email, password_hash="dummy", auth_provider="google")
    db_session.add(user)
    db_session.commit()

    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token2"}
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"email": email}

    with patch(
        "src.modules.auth.oauth.service.OAuthStateService.validate_state",
        return_value=True,
    ):
        response = client.get(
            "/auth/google/callback?code=abc&state=xyz", follow_redirects=False
        )
        assert response.status_code == 307
        location = response.headers.get("location", "")
        assert "/auth/callback?token=" in location

        # User should still exist only once
        count = db_session.query(User).filter_by(email=email).count()
        assert count == 1


def test_oauth_callback_rejects_invalid_state(client):
    """
    Invalid OAuth state should redirect to frontend login with error.
    """
    with patch(
        "src.modules.auth.oauth.service.OAuthStateService.validate_state",
        return_value=False,
    ):
        response = client.get(
            "/auth/google/callback?code=abc&state=invalid", follow_redirects=False
        )
        assert response.status_code == 307
        location = response.headers.get("location", "")
        assert "error=state_invalid" in location


def test_oauth_callback_handles_profile_without_email(
    client, mock_httpx_post, mock_httpx_get
):
    """
    OAuth profile without email should redirect to frontend login with error.
    """
    mock_httpx_post.return_value.status_code = 200
    mock_httpx_post.return_value.json.return_value = {"access_token": "fake_token"}
    mock_httpx_get.return_value.status_code = 200
    mock_httpx_get.return_value.json.return_value = {"id": "12345"}

    with patch(
        "src.modules.auth.oauth.service.OAuthStateService.validate_state",
        return_value=True,
    ):
        response = client.get(
            "/auth/google/callback?code=abc&state=valid_state", follow_redirects=False
        )
        assert response.status_code == 307
        location = response.headers.get("location", "")
        assert "error=" in location
