from uuid import uuid4

from tests.helpers import create_test_user


def test_internal_error_does_not_leak_sensitive_info(client):
    """Login com credenciais inválidas retorna 401 genérico, sem stack trace."""
    response = client.post(
        "/auth/login",
        data={"username": "not-an-email", "password": "Whatever123!"},
    )
    assert response.status_code == 401
    assert "Traceback" not in response.text
    assert response.json()["detail"] == "Credenciais inválidas"
    assert "password_hash" not in response.text
    assert "sqlalchemy" not in response.text.lower()


def test_auth_response_contains_no_sensitive_fields(client):
    email = f"secure_user_{uuid4()}@cafe.com"
    payload = {
        "email": email,
        "name": "Secure User",
        "company": "Secure Co",
        "password": "StrongPassword123!",
    }
    create_test_user(
        email=payload["email"],
        name=payload["name"],
        company=payload["company"],
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": payload["password"]}
    )
    token = resp.json()["access_token"]
    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    data = response.json()

    # Campos que NÃO devem estar no JSON de resposta
    forbidden = ["password", "password_hash", "hashed_password", "salt"]
    for field in forbidden:
        assert field not in data
        assert field not in response.text


def test_reject_unsupported_auth_schemes(client):
    # Tenta usar "Basic" ou "Digest" em vez de "Bearer"
    headers = {"Authorization": "Basic dGVzdGU6dGVzdGU="}
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 401
