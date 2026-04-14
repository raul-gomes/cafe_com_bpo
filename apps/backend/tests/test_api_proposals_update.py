import pytest
from uuid import uuid4

def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_put_proposal_updates_existing_record(client):
    email = f"update_test_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    
    # 1. Cria uma proposta
    create_payload = {
        "client_name": "Antigo Nome",
        "input_payload": {"original": True},
        "result_payload": {"price": 100}
    }
    resp_create = client.post("/api/proposals/", json=create_payload, headers=auth)
    proposal_id = resp_create.json()["id"]
    
    # 2. Tenta atualizar (Deve falhar com 405 ou 404 por enquanto pois a rota não existe)
    update_payload = {
        "client_name": "Novo Nome",
        "input_payload": {"original": False},
        "result_payload": {"price": 200}
    }
    resp_update = client.put(f"/api/proposals/{proposal_id}", json=update_payload, headers=auth)
    
    # RED Phase verification
    assert resp_update.status_code == 200
    data = resp_update.json()
    assert data["client_name"] == "Novo Nome"
    assert data["input_payload"] == {"original": False}

def test_put_proposal_returns_404_for_non_existent(client):
    email = f"update_not_found_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    random_id = uuid4()
    
    response = client.put(f"/api/proposals/{random_id}", json={"client_name": "X", "input_payload": {}, "result_payload": {}}, headers=auth)
    assert response.status_code == 404

def test_put_proposal_prevents_unauthorized_edit(client):
    # Usuário A cria proposta
    email_a = f"auth_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    resp_create = client.post("/api/proposals/", json={"client_name": "A", "input_payload": {}, "result_payload": {}}, headers=auth_a)
    proposal_id = resp_create.json()["id"]
    
    # Usuário B tenta editar proposta do A
    email_b = f"auth_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)
    
    resp_update = client.put(f"/api/proposals/{proposal_id}", json={"client_name": "Hacked", "input_payload": {}, "result_payload": {}}, headers=auth_b)
    
    # Deve retornar 404 (ocultando existência) ou 403. O padrão atual é 404.
    assert resp_update.status_code == 404
