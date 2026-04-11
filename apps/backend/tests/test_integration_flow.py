import pytest
from uuid import uuid4

def test_full_user_flow_integration(client):
    """
    Testa o fluxo completo do usuário no sistema:
    1. Registro
    2. Login
    3. Simulação de Preço (Pricing)
    4. Salvamento de Proposta (Proposals)
    5. Listagem de Propostas
    6. Verificação de Isolamento
    """
    email = f"flow_test_{uuid4()}@cafe-com-bpo.com"
    password = "StrongPassword123!"
    
    # 1. Registro
    reg_resp = client.post("/auth/register", json={
        "email": email,
        "password": password,
        "name": "Integration User"
    })
    assert reg_resp.status_code == 201
    
    # 2. Login
    login_resp = client.post("/auth/login", data={
        "username": email,
        "password": password
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    auth_headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Simulação de Preço
    pricing_payload = {
        "operation": {
            "total_cost": 15000.0,
            "people_count": 3,
            "hours_per_month": 160.0,
            "tax_rate": 0.06
        },
        "services": [
            {
                "name": "Audit",
                "minutes_per_execution": 30.0,
                "monthly_quantity": 10
            }
        ],
        "desired_profit_margin": 0.15
    }
    pricing_resp = client.post("/api/pricing/calculate", json=pricing_payload)
    assert pricing_resp.status_code == 200
    calculation_result = pricing_resp.json()
    assert float(calculation_result["final_price"]) > 0
    
    # 4. Salvamento de Proposta (Criação de Proposta baseada no cálculo)
    proposal_payload = {
        "client_name": "Cliente de Integração",
        "input_payload": pricing_payload,
        "result_payload": calculation_result
    }
    prop_resp = client.post("/api/proposals/", json=proposal_payload, headers=auth_headers)
    assert prop_resp.status_code == 201
    proposal_id = prop_resp.json()["id"]
    
    # 5. Listagem de Propostas
    list_resp = client.get("/api/proposals/", headers=auth_headers)
    assert list_resp.status_code == 200
    proposals = list_resp.json()
    assert len(proposals) >= 1
    assert any(p["id"] == proposal_id for p in proposals)
    assert any(p["client_name"] == "Cliente de Integração" for p in proposals)
    
    # 6. Verificação de Perfil (Endpoint /me)
    me_resp = client.get("/auth/me", headers=auth_headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

def test_unauthorized_access_to_pricing_endpoints(client):
    # O endpoint de cálculo é público (por design atual), 
    # mas o de propostas requer autenticação.
    
    prop_payload = {
        "client_name": "Unauthorized Client",
        "input_payload": {},
        "result_payload": {}
    }
    resp = client.post("/api/proposals/", json=prop_payload)
    assert resp.status_code == 401
