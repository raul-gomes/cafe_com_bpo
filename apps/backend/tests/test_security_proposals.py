import pytest
from uuid import uuid4

def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_user_cannot_access_other_users_proposal(client):
    # 1. Configura Usuário A e cria uma proposta
    email_a = f"user_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    
    prop_payload = {
        "client_name": "Empresa do A",
        "input_payload": {"test": "data"},
        "result_payload": {"final_price": 1000}
    }
    resp_create = client.post("/api/proposals/", json=prop_payload, headers=auth_a)
    proposal_id = resp_create.json()["id"]

    # 2. Configura Usuário B
    email_b = f"user_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)

    # 3. Usuário B tenta listar (não deve ver a proposta do A)
    resp_list = client.get("/api/proposals/", headers=auth_b)
    assert resp_list.status_code == 200
    assert not any(p["id"] == proposal_id for p in resp_list.json())

    # 4. Caso tivéssemos GET por ID individual, testaríamos aqui. 
    # Atualmente a listagem já prova o isolamento do filtro por user_id.

def test_proposals_list_is_strictly_filtered_by_owner(client):
    email_a = f"owner_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    
    # Usuário A cria 2 propostas
    for i in range(2):
        client.post("/api/proposals/", json={
            "client_name": f"Prop {i}",
            "input_payload": {},
            "result_payload": {}
        }, headers=auth_a)

    # Usuário B cria 1 proposta
    email_b = f"owner_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)
    client.post("/api/proposals/", json={
        "client_name": "Prop B",
        "input_payload": {},
        "result_payload": {}
    }, headers=auth_b)

    # Verifica se A só vê as suas 2
    resp_a = client.get("/api/proposals/", headers=auth_a)
    assert len(resp_a.json()) == 2
    
    # Verifica se B só vê a sua 1
    resp_b = client.get("/api/proposals/", headers=auth_b)
    assert len(resp_b.json()) == 1
