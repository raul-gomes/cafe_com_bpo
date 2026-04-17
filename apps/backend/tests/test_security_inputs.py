

def test_pricing_calculator_rejects_malformed_json(client):
    # Payload com tipos errados (ex: string onde deve ser number)
    payload = {
        "operation": {
            "total_cost": "MUITO_CARO", # Erro aqui
            "people_count": 1,
            "hours_per_month": 160,
            "tax_rate": 0.06
        },
        "services": [],
        "desired_profit_margin": 0.5
    }
    response = client.post("/api/pricing/calculate", json=payload)
    # Pydantic deve barrar com 422
    assert response.status_code == 422
    # Garante que a mensagem de erro é segura e aponta o campo
    assert "total_cost" in response.text

def test_pricing_calculator_handles_large_payload_safely(client):
    # Simula um payload grande com muitos serviços
    large_services = [
        {"id": i, "name": "S"*100, "type": "time", "minutes_per_execution": 10, "monthly_quantity": 100}
        for i in range(500)
    ]
    payload = {
        "operation": {
            "total_cost": 10000,
            "people_count": 2,
            "hours_per_month": 160,
            "tax_rate": 0.06
        },
        "services": large_services,
        "desired_profit_margin": 0.5
    }
    response = client.post("/api/pricing/calculate", json=payload)
    # Deve processar ou retornar erro controlado de tamanho de entidade (413), 
    # mas não deve dar 500 ou quebrar o processo.
    assert response.status_code in [200, 413, 422]

def test_login_rejects_excessive_payload_size(client):
    # Tenta um "brute force" de payload no campo de e-mail
    huge_email = "a" * 10000 + "@test.com"
    form_data = {"username": huge_email, "password": "any"}
    response = client.post("/auth/login", data=form_data)
    # Deve falhar de forma segura
    assert response.status_code in [401, 422]
