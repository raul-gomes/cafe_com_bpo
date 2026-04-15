import pytest
from uuid import uuid4

def test_register_user_returns_201_and_user_payload(client):
    email = f"test_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["email"] == email
    assert "id" in response.json()

def test_register_rejects_duplicate_email(client):
    email = f"duplicate_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "uso" in response.text

def test_register_rejects_weak_password(client):
    email = f"weak_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "123"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 422

def test_login_returns_access_token(client):
    email = f"login_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    
    form_data = {"username": email, "password": "StrongPassword123!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"

def test_login_rejects_wrong_password(client):
    email = f"loginwrong_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    
    form_data = {"username": email, "password": "WrongPassword!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 401

def test_protected_route_rejects_missing_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401

def test_protected_route_rejects_expired_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer BAD_TOKEN"})
    assert response.status_code == 401

def test_auth_response_never_returns_password_hash(client):
    email = f"safe_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    response = client.post("/auth/register", json=payload)
    assert "password" not in response.text
    assert "password_hash" not in response.text

def test_error_messages_do_not_allow_user_enumeration(client):
    form_data = {"username": f"unknown_{uuid4()}@cafe.com", "password": "AnyPassword!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais inválidas"

def test_upload_avatar_success(client):
    email = f"avatar_user_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]
    
    # Fake file payload
    file_payload = {"file": ("test_avatar.png", b"fake_image_content", "image/png")}
    response = client.post(
        "/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files=file_payload
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "avatar_url" in data
    assert data["avatar_url"].startswith("/avatars/")
    assert data["avatar_url"].endswith(".png")

def test_upload_avatar_requires_auth(client):
    file_payload = {"file": ("test_avatar.png", b"fake_image_content", "image/png")}
    response = client.post(
        "/auth/me/avatar",
        files=file_payload
    )
    
    assert response.status_code == 401
