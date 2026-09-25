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


def test_delete_prospect_removes_linked_proposals_and_contracts(client):
    email = f"prospect_cascade_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Cascade Target").json()

    # Orçamento vinculado ao prospecto
    resp_prop = client.post(
        "/proposals/",
        json={
            "client_name": prospect["name"],
            "input_payload": {"p": 1},
            "result_payload": {"price": 500},
            "prospect_id": prospect["id"],
        },
        headers=auth,
    )
    assert resp_prop.status_code == 201
    proposal = resp_prop.json()

    # Contrato vinculado ao prospecto + orçamento
    resp_contract = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    )
    assert resp_contract.status_code == 201
    contract = resp_contract.json()

    # Link público do orçamento funcionando antes do delete
    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rstrip("/").split("/")[-1]
    assert client.get(f"/proposals/public/{share_hash}").status_code == 200

    # Deleta o prospecto
    resp_del = client.delete(f"/prospects/{prospect['id']}", headers=auth)
    assert resp_del.status_code == 204

    # Prospecto some da listagem
    assert client.get("/prospects/", headers=auth).json() == []

    # Orçamento some da listagem e do detalhe
    proposals = client.get("/proposals/", headers=auth).json()
    assert all(p["id"] != proposal["id"] for p in proposals)
    assert client.get(f"/proposals/{proposal['id']}", headers=auth).status_code == 404

    # Link público do orçamento deixa de funcionar
    assert client.get(f"/proposals/public/{share_hash}").status_code == 404

    # Contrato some da listagem e do detalhe
    contracts = client.get("/contracts/", headers=auth).json()
    assert all(c["id"] != contract["id"] for c in contracts)
    assert client.get(f"/contracts/{contract['id']}", headers=auth).status_code == 404


def test_delete_prospect_cascade_is_user_scoped(client):
    email_a = f"prospect_casc_a_{uuid4()}@cafe.com"
    auth_a = get_auth_header(client, email_a)
    prospect_a = create_prospect(client, auth_a, name="De A").json()
    proposal_a = client.post(
        "/proposals/",
        json={
            "client_name": prospect_a["name"],
            "input_payload": {"p": 1},
            "result_payload": {"price": 500},
            "prospect_id": prospect_a["id"],
        },
        headers=auth_a,
    ).json()
    contract_a = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect_a["id"], "proposal_id": proposal_a["id"]},
        headers=auth_a,
    ).json()

    email_b = f"prospect_casc_b_{uuid4()}@cafe.com"
    auth_b = get_auth_header(client, email_b)
    prospect_b = create_prospect(client, auth_b, name="De B").json()
    proposal_b = client.post(
        "/proposals/",
        json={
            "client_name": prospect_b["name"],
            "input_payload": {"p": 1},
            "result_payload": {"price": 300},
            "prospect_id": prospect_b["id"],
        },
        headers=auth_b,
    ).json()
    contract_b = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect_b["id"], "proposal_id": proposal_b["id"]},
        headers=auth_b,
    ).json()

    # IDOR: usuário B não pode apagar o prospecto de A
    assert (
        client.delete(f"/prospects/{prospect_a['id']}", headers=auth_b).status_code
        == 404
    )

    # A apaga SEU prospecto → cascade só nos dados de A
    assert (
        client.delete(f"/prospects/{prospect_a['id']}", headers=auth_a).status_code
        == 204
    )

    assert (
        client.get(f"/proposals/{proposal_a['id']}", headers=auth_a).status_code == 404
    )
    assert (
        client.get(f"/contracts/{contract_a['id']}", headers=auth_a).status_code == 404
    )

    # Dados de B permanecem intactos
    assert client.get("/prospects/", headers=auth_b).json()[0]["id"] == prospect_b["id"]
    proposals_b = client.get("/proposals/", headers=auth_b).json()
    assert any(p["id"] == proposal_b["id"] for p in proposals_b)
    contracts_b = client.get("/contracts/", headers=auth_b).json()
    assert any(c["id"] == contract_b["id"] for c in contracts_b)
    assert (
        client.get(f"/proposals/{proposal_b['id']}", headers=auth_b).status_code == 200
    )
    assert (
        client.get(f"/contracts/{contract_b['id']}", headers=auth_b).status_code == 200
    )


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


def test_create_prospect_with_representante_fields(client):
    email = f"prospect_rep_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    resp = create_prospect(
        client,
        auth,
        representante_nome="Maria Silva",
        representante_email="maria@potencial.com",
        representante_cpf="123.456.789-01",
        representante_telefone="(11) 97777-1234",
        representante_cargo="CFO",
    )

    assert resp.status_code == 201
    data = resp.json()
    assert data["representante_nome"] == "Maria Silva"
    assert data["representante_email"] == "maria@potencial.com"
    assert data["representante_cpf"] == "12345678901"
    assert data["representante_telefone"] == "11977771234"
    assert data["representante_cargo"] == "CFO"


def test_update_prospect_representante_fields(client):
    email = f"prospect_rep_upd_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()

    resp = client.put(
        f"/prospects/{prospect['id']}",
        json={
            "representante_nome": "João Souza",
            "representante_cargo": "Diretor",
            "representante_cpf": "987.654.321-00",
        },
        headers=auth,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["representante_nome"] == "João Souza"
    assert data["representante_cargo"] == "Diretor"
    assert data["representante_cpf"] == "98765432100"
    assert data["representante_email"] is None
    assert data["representante_telefone"] is None


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


def test_reprove_prospect_sets_binary_flag(client):
    email = f"prospect_reprove_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Empresa Reprovada").json()
    assert prospect["reproved_at"] is None

    resp = client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)

    assert resp.status_code == 200
    data = resp.json()
    assert data["reproved_at"] is not None
    assert data["converted_client_id"] is None

    # Sai da listagem de Prospectos (vira Perdido na Governança)
    listed = client.get("/prospects/", headers=auth).json()
    assert all(p["id"] != prospect["id"] for p in listed)

    # Volta à negociação → reaparece na listagem
    resp = client.post(f"/prospects/{prospect['id']}/unreprove", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["reproved_at"] is None

    listed = client.get("/prospects/", headers=auth).json()
    assert any(p["id"] == prospect["id"] for p in listed)


def test_unreprove_returns_to_negotiation(client):
    email = f"prospect_unreprove_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()
    client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)

    resp = client.post(f"/prospects/{prospect['id']}/unreprove", headers=auth)

    assert resp.status_code == 200
    assert resp.json()["reproved_at"] is None


def test_reprove_keeps_prospect_creatable_again(client):
    email = f"prospect_reprove2_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()

    resp = client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)
    assert resp.status_code == 200

    resp = client.post(f"/prospects/{prospect['id']}/unreprove", headers=auth)
    assert resp.status_code == 200
    assert resp.json()["reproved_at"] is None

    listed = client.get("/prospects/", headers=auth).json()
    assert any(p["id"] == prospect["id"] for p in listed)


def test_reprove_converted_prospect_conflict(client):
    email = f"prospect_reprove_conv_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()
    client.post(f"/prospects/{prospect['id']}/convert", headers=auth)

    resp = client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)

    # Convertido sai da listagem ativa (is_active=False) → não encontrado
    assert resp.status_code == 404


def test_governanca_endpoints_require_authentication(client):
    assert client.get("/governanca/deals").status_code == 401
