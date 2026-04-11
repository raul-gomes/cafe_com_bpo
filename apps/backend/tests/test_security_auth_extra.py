import pytest
from uuid import uuid4

def test_internal_error_does_not_leak_sensitive_info(client):
    # Simula um erro que poderia acontecer no banco
    # Ao tentar registrar um e-mail inválido que passe no regex mas dê erro no DB
    response = client.post("/auth/register", json={
        "email": "not-an-email", 
        "password": "Short"
    })
    # Deve retornar erro de validação (422) e não um erro de banco (500) com stack trace
    assert response.status_code == 422
    assert "password_hash" not in response.text
    assert "sqlalchemy" not in response.text.lower()

def test_auth_response_contains_no_sensitive_fields(client):
    email = f"secure_user_{uuid4()}@cafe.com"
    payload = {
        "email": email, 
        "name": "Secure User", 
        "company": "Secure Co", 
        "password": "StrongPassword123!"
    }
    response = client.post("/auth/register", json=payload)
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
