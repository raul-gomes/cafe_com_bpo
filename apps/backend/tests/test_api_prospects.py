import uuid
from uuid import uuid4

from tests.helpers import register_user


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_prospect(client, auth, name="Empresa Potencial", **overrides):
    payload = {
        "name": name,
        "cnpj": "12.345.678/0001-99",
        "phone": "(11) 98888-7777",
        "email": f"contato{uuid4()}@potencial.com",
        "segment": "B2B - Tecnologia & Software",
        **overrides,
    }
    return client.post("/prospects/", json=payload, headers=auth)


def test_create_prospect_success(client):
    email = f"prospect_ok_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = create_prospect(client, auth)

    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Empresa Potencial"
    assert data["cnpj"] == "12345678000199"
    assert data["phone"] == "11988887777"
    assert data["converted_client_id"] is None
    assert "id" in data


def test_create_prospect_with_normalized_address(client):
    email = f"prospect_cep_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = create_prospect(
        client,
        auth,
        cep="01310100",
        street="Avenida Paulista",
        number="1000",
        neighborhood="Bela Vista",
        city="São Paulo",
        state="SP",
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["cep"] == "01310100"
    assert data["street"] == "Avenida Paulista"
    assert data["number"] == "1000"
    assert data["neighborhood"] == "Bela Vista"
    assert data["city"] == "São Paulo"
    assert data["state"] == "SP"


def test_create_prospect_missing_name(client):
    email = f"prospect_missing_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = client.post("/prospects/", json={"email": "x@y.com"}, headers=auth)

    assert resp.status_code == 422
    assert "name" in resp.text


def test_list_prospects_isolation(client):
    email_a = f"prospect_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    create_prospect(client, auth_a, name="Da usuária A")

    email_b = f"prospect_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)
    create_prospect(client, auth_b, name="Da usuária B")
    create_prospect(client, auth_b, name="Outra da B")

    resp_a = client.get("/prospects/", headers=auth_a)
    assert resp_a.status_code == 200
    assert len(resp_a.json()) == 1
    assert resp_a.json()[0]["name"] == "Da usuária A"

    resp_b = client.get("/prospects/", headers=auth_b)
    names = [p["name"] for p in resp_b.json()]
    assert len(names) == 2
    assert "Da usuária B" in names
    assert "Outra da B" in names


def test_update_prospect_isolation_and_fields(client):
    email_a = f"prospect_upd_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    prospect = create_prospect(client, auth_a).json()

    email_b = f"prospect_upd_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)

    # IDOR: usuário B não pode editar prospect de A
    resp_idor = client.put(
        f"/prospects/{prospect['id']}",
        json={"name": "Hacked"},
        headers=auth_b,
    )
    assert resp_idor.status_code == 404

    # A edita o próprio
    resp_upd = client.put(
        f"/prospects/{prospect['id']}",
        json={"street": "Av. Paulista", "number": "1000", "segment": "Outro"},
        headers=auth_a,
    )
    assert resp_upd.status_code == 200
    assert resp_upd.json()["street"] == "Av. Paulista"
    assert resp_upd.json()["number"] == "1000"
    assert resp_upd.json()["segment"] == "Outro"
    assert resp_upd.json()["name"] == "Empresa Potencial"


def test_archive_prospect_removes_from_list(client):
    email = f"prospect_arch_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()

    resp_del = client.delete(f"/prospects/{prospect['id']}", headers=auth)
    assert resp_del.status_code == 204

    resp_list = client.get("/prospects/", headers=auth)
    assert resp_list.status_code == 200
    assert resp_list.json() == []


def test_prospects_endpoints_require_authentication(client):
    assert client.post("/prospects/", json={"name": "X"}).status_code == 401
    assert client.get("/prospects/").status_code == 401
    assert client.post(f"/prospects/{uuid4()}/convert").status_code == 401


def test_convert_prospect_creates_client_without_team(client):
    email = f"prospect_conv_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(
        client,
        auth,
        name="Cliente que Contratou",
        description="Lead convertido",
        segment="B2B - Consultoria & Assessoria",
        cep="01310100",
        street="Avenida Paulista",
        number="1000",
        complement="Conj 55",
        neighborhood="Bela Vista",
        city="São Paulo",
        state="SP",
    ).json()

    resp = client.post(f"/prospects/{prospect['id']}/convert", headers=auth)

    assert resp.status_code == 200
    data = resp.json()
    assert data["client_id"] is not None
    assert data["prospect_id"] == prospect["id"]

    # Prospect some da listagem de prospects (convertido)
    resp_prospects = client.get("/prospects/", headers=auth)
    assert resp_prospects.json() == []

    # Cliente criado com os mesmos dados cadastrais
    resp_clients = client.get("/clients/", headers=auth)
    assert resp_clients.status_code == 200
    created = [c for c in resp_clients.json() if c["id"] == data["client_id"]]
    assert len(created) == 1
    assert created[0]["name"] == "Cliente que Contratou"
    assert created[0]["description"] == "Lead convertido"
    assert created[0]["segment"] == "B2B - Consultoria & Assessoria"
    assert created[0]["phone"] == "11988887777"
    assert created[0]["cep"] == "01310100"
    assert created[0]["street"] == "Avenida Paulista"
    assert created[0]["number"] == "1000"
    assert created[0]["complement"] == "Conj 55"
    assert created[0]["neighborhood"] == "Bela Vista"
    assert created[0]["city"] == "São Paulo"
    assert created[0]["state"] == "SP"

    # Conversão não cria time/equipe associada (cliente puro do cadastro)
    from src.core.database import SessionLocal
    from src.modules.team.models import Team

    session = SessionLocal()
    try:
        team = (
            session.query(Team)
            .filter(Team.client_id == uuid.UUID(data["client_id"]))
            .first()
        )
        assert team is None
    finally:
        session.close()


def test_convert_prospect_is_idempotent_and_protected(client):
    email_a = f"prospect_conv_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    prospect = create_prospect(client, auth_a).json()

    email_b = f"prospect_conv_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)

    # IDOR: usuário B não converte prospect de A
    resp_idor = client.post(f"/prospects/{prospect['id']}/convert", headers=auth_b)
    assert resp_idor.status_code == 404

    # A converte
    resp1 = client.post(f"/prospects/{prospect['id']}/convert", headers=auth_a)
    assert resp1.status_code == 200

    # Segunda conversão do mesmo prospect -> 404 (já saiu da listagem ativa)
    resp2 = client.post(f"/prospects/{prospect['id']}/convert", headers=auth_a)
    assert resp2.status_code == 404


def test_proposal_can_reference_prospect(client):
    email = f"prospect_prop_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Para Orçamento").json()

    resp = client.post(
        "/proposals/",
        json={
            "client_name": prospect["name"],
            "input_payload": {"prospecto": True},
            "result_payload": {"price": 500},
            "prospect_id": prospect["id"],
        },
        headers=auth,
    )
    assert resp.status_code == 201
    assert resp.json()["prospect_id"] == prospect["id"]
    assert resp.json()["client_name"] == "Para Orçamento"
