"""AUD-011: the refresh cookie requires HTTPS outside development and tests."""

import pytest

from src.core.config import get_settings
from tests.helpers import register_user, unique_email

PASSWORD = "StrongPassword123!"


def _login_set_cookie(client) -> str:
    """Registers a user, logs in and returns the Set-Cookie header.

    Args:
        client: Test client.

    Returns:
        The raw Set-Cookie header of the login response.
    """
    email = unique_email("cookie")
    register_user(payload={"email": email, "password": PASSWORD})
    resp = client.post("/auth/login", data={"username": email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.headers["set-cookie"]


@pytest.mark.parametrize("mode", ["production", "staging"])
def test_cookie_is_secure_outside_development(client, monkeypatch, mode):
    monkeypatch.setattr(get_settings(), "mode", mode)
    cookie = _login_set_cookie(client)
    assert "refresh_token=" in cookie
    assert "Secure" in cookie
    assert "HttpOnly" in cookie


def test_cookie_allows_plain_http_in_tests_and_development(client):
    cookie = _login_set_cookie(client)
    assert "refresh_token=" in cookie
    assert "Secure" not in cookie


def test_logout_clears_the_cookie_with_the_same_attributes(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "mode", "production")
    resp = client.post("/auth/logout")
    assert "refresh_token=" in resp.headers["set-cookie"]
    assert "Secure" in resp.headers["set-cookie"]
