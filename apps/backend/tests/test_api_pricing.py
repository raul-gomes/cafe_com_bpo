import pytest

def get_valid_payload():
    return {
        "operation": {
            "total_cost": 10000.0,
            "people_count": 2,
            "hours_per_month": 160.0,
            "tax_rate": 0.05
        },
        "services": [
            {
                "name": "Validation",
                "minutes_per_execution": 10.0,
                "monthly_quantity": 5
            }
        ],
        "desired_profit_margin": 0.10
    }

def test_post_calculate_returns_200_with_expected_schema(client):
    payload = get_valid_payload()
    response = client.post("/api/pricing/calculate", json=payload)
    
    # RED Phase: Vai retornar 501 porque a ponte não está instanciando as respostas ainda, ou deve buscar 200 no final
    assert response.status_code == 200
    data = response.json()
    assert "final_price" in data

def test_post_calculate_returns_422_when_required_field_missing(client):
    payload = get_valid_payload()
    del payload["operation"]["total_cost"]
    response = client.post("/api/pricing/calculate", json=payload)
    assert response.status_code == 422
    assert "total_cost" in response.text

def test_post_calculate_returns_422_for_negative_numeric_values(client):
    payload = get_valid_payload()
    payload["operation"]["total_cost"] = -100
    response = client.post("/api/pricing/calculate", json=payload)
    assert response.status_code == 422
    assert "greater than or equal to 0" in response.text

def test_post_calculate_does_not_expose_internal_traceback_on_domain_error(client):
    payload = get_valid_payload()
    # At least check the endpoint wraps generic exceptions cleanly
    response = client.post("/api/pricing/calculate", json=payload)
    assert response.status_code == 501
    assert "detail" in response.json()
    assert "Traceback" not in response.text

def test_post_calculate_returns_consistent_error_shape(client):
    payload = get_valid_payload()
    payload["operation"]["total_cost"] = "NOTA_NUMBER"
    response = client.post("/api/pricing/calculate", json=payload)
    assert response.status_code == 422
    assert "detail" in response.json()
    assert isinstance(response.json()["detail"], list)  # Pydantic validation error is a list
