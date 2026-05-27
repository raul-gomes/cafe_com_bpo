from uuid import uuid4


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_client_success(client):
    email = f"client_test_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    payload = {
        "name": "Super Empresa",
        "cnpj": "12.345.678/0001-99",
        "phone": "11999999999",
        "email": "contato@superempresa.com",
    }

    resp = client.post("/clients/", json=payload, headers=auth)

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Super Empresa"
    assert data["cnpj"] == "12.345.678/0001-99"
    assert "id" in data


def test_create_client_missing_fields(client):
    email = f"client_missing_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    # name is required
    payload = {"cnpj": "12.345.678/0001-99"}

    resp = client.post("/clients/", json=payload, headers=auth)
    assert resp.status_code == 422
    assert "name" in resp.text


def test_get_clients_success_and_isolation(client):
    # User A creates a client
    email_a = f"user_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    client.post("/clients/", json={"name": "Cliente do A"}, headers=auth_a)

    # User B creates a client
    email_b = f"user_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)
    client.post("/clients/", json={"name": "Cliente do B"}, headers=auth_b)
    client.post("/clients/", json={"name": "Outro Cliente do B"}, headers=auth_b)

    # Get user A clients
    resp_a = client.get("/clients/", headers=auth_a)
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert len(data_a) == 1
    assert data_a[0]["name"] == "Cliente do A"

    # Get user B clients
    resp_b = client.get("/clients/", headers=auth_b)
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert len(data_b) == 2
    names = [c["name"] for c in data_b]
    assert "Cliente do B" in names
    assert "Outro Cliente do B" in names


def test_create_client_with_address(client):
    email = f"client_addr_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    payload = {
        "name": "Empresa com Endereço",
        "cnpj": "98.765.432/0001-10",
        "address": "Rua Example, 123, Centro, São Paulo - SP, 01001-000",
    }

    resp = client.post("/clients/", json=payload, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["address"] == "Rua Example, 123, Centro, São Paulo - SP, 01001-000"

    # GET should also return address
    resp_get = client.get("/clients/", headers=auth)
    assert resp_get.status_code == 200
    clients = resp_get.json()
    assert any(c["address"] == payload["address"] for c in clients)


def test_update_client_address(client):
    email = f"client_upd_addr_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    # Create client without address
    resp = client.post("/clients/", json={"name": "Empresa Teste"}, headers=auth)
    client_id = resp.json()["id"]

    # Update with address
    resp_upd = client.put(
        f"/clients/{client_id}",
        json={"address": "Av. Paulista, 1000, Bela Vista, São Paulo - SP"},
        headers=auth,
    )
    assert resp_upd.status_code == 200
    assert resp_upd.json()["address"] == "Av. Paulista, 1000, Bela Vista, São Paulo - SP"


def test_clients_endpoints_require_authentication(client):
    payload = {"name": "Hacked Client"}

    # Try POST
    resp_post = client.post("/clients/", json=payload)
    assert resp_post.status_code == 401

    # Try GET
    resp_get = client.get("/clients/")
    assert resp_get.status_code == 401
