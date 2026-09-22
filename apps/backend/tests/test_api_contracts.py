from uuid import uuid4

from tests.helpers import register_user


def _auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_prospect(client, auth, name="Empresa Contrato"):
    payload = {
        "name": name,
        "cnpj": "12.345.678/0001-99",
        "phone": "(11) 98888-7777",
        "email": f"contrato{uuid4()}@potencial.com",
        "segment": "B2B - Tecnologia & Software",
        "street": "Avenida Paulista",
        "number": "1000",
        "neighborhood": "Bela Vista",
        "city": "São Paulo",
        "state": "SP",
        "cep": "01310100",
    }
    return client.post("/prospects/", json=payload, headers=auth)


def _create_proposal(client, auth, prospect, final_price=1250.0):
    payload = {
        "client_name": prospect["name"],
        "input_payload": {
            "operation": {
                "people_count": 3,
                "hours_per_month": 160,
                "total_cost": 15000,
            },
            "desired_profit_margin": 0.5,
            "term_discount": 0.1,
            "complexity": "Média",
            "revenue": 50000,
        },
        "result_payload": {
            "final_price": final_price,
            "price_before_discount": 1388.89,
            "discount_amount": 138.89,
            "breakdown": {"total_service_cost": 833.33},
        },
        "prospect_id": prospect["id"],
    }
    return client.post("/proposals/", json=payload, headers=auth)


def test_get_template_creates_empty_default(client):
    email = f"tmpl_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)

    resp = client.get("/contracts/templates", headers=auth)

    assert resp.status_code == 200
    assert resp.json()["sections"] == []


def test_update_template_sections(client):
    email = f"tmpl_upd_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)

    put = client.put(
        "/contracts/templates",
        json={
            "sections": [
                {"title": "Das Partes", "content": "Contrato entre {{nome}} e X"},
                {
                    "title": "Do Objeto",
                    "content": "Serviços de BPO por {{valor_mensal}}",
                },
            ]
        },
        headers=auth,
    )
    assert put.status_code == 200
    returned = put.json()["sections"]
    assert len(returned) == 2
    assert returned[0]["title"] == "Das Partes"

    get = client.get("/contracts/templates", headers=auth)
    assert len(get.json()["sections"]) == 2


def test_generate_substitutes_prospect_and_proposal_data(client):
    email = f"gen_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth, name="Contratante XPTO").json()
    proposal = _create_proposal(client, auth, prospect).json()
    client.put(
        "/contracts/templates",
        json={
            "sections": [
                {
                    "title": "Das Partes",
                    "content": (
                        "A empresa {{nome}}, CNPJ {{cnpj}}, "
                        "com sede na {{endereco}}, email {{email}}"
                    ),
                },
                {
                    "title": "Do Objeto",
                    "content": (
                        "Preço mensal de {{valor_mensal}} "
                        "(serviços: {{valor_servicos}}; "
                        "desconto de prazo {{desconto_prazo}})"
                    ),
                },
            ]
        },
        headers=auth,
    )

    resp = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    )

    assert resp.status_code == 201
    contract = resp.json()
    assert contract["client_name"] == "Contratante XPTO"
    assert contract["prospect_id"] == prospect["id"]
    assert contract["proposal_id"] == proposal["id"]
    assert contract["status"] == "draft"

    part1 = contract["sections"][0]["content"]
    assert "Contratante XPTO" in part1
    assert "CNPJ {{cnpj}}" not in part1
    assert "12345678000199" in part1

    part2 = contract["sections"][1]["content"]
    assert "R$ 1.250,00" in part2
    assert "R$ 833,33" in part2
    assert "10%" in part2


def test_generate_without_proposal_keeps_orcamento_tokens(client):
    email = f"gen_no_prop_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth, name="Sem Orçamento").json()
    client.put(
        "/contracts/templates",
        json={
            "sections": [
                {
                    "title": "Do Objeto",
                    "content": "Valor mensal: {{valor_mensal}} para {{nome}}",
                }
            ]
        },
        headers=auth,
    )

    resp = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    )

    assert resp.status_code == 201
    content = resp.json()["sections"][0]["content"]
    assert "{{valor_mensal}}" in content
    assert "Sem Orçamento" in content


def test_contracts_are_isolated_by_user(client):
    email_a = f"iso_a_{uuid4()}@cafe.com"
    auth_a = _auth_header(client, email_a)
    prospect = _create_prospect(client, auth_a).json()
    generated = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth_a
    ).json()

    email_b = f"iso_b_{uuid4()}@cafe.com"
    auth_b = _auth_header(client, email_b)

    list_b = client.get("/contracts/", headers=auth_b)
    assert list_b.json() == []

    detail = client.get(f"/contracts/{generated['id']}", headers=auth_b)
    assert detail.status_code == 404


def test_update_sections_while_draft(client):
    email = f"upd_draft_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    contract = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()

    patch = client.patch(
        f"/contracts/{contract['id']}",
        json={"sections": [{"title": "Cláusula Única", "content": "Texto novo"}]},
        headers=auth,
    )

    assert patch.status_code == 200
    assert patch.json()["sections"][0]["title"] == "Cláusula Única"
    assert patch.json()["sections"][0]["content"] == "Texto novo"


def test_finalize_converts_prospect_and_locks_contract(client):
    email = f"fin_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth, name="Para Converter").json()
    contract = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()

    fin = client.post(f"/contracts/{contract['id']}/finalize", headers=auth)

    assert fin.status_code == 200
    data = fin.json()
    assert data["contract_id"] == contract["id"]
    assert data["client_id"] is not None

    # Contrato travado
    patch = client.patch(
        f"/contracts/{contract['id']}",
        json={"sections": [{"title": "X", "content": "hack"}]},
        headers=auth,
    )
    assert patch.status_code == 409

    detail = client.get(f"/contracts/{contract['id']}", headers=auth)
    assert detail.json()["status"] == "finalized"
    assert detail.json()["finalized_at"] is not None

    # Prospecto some da listagem e virou cliente
    prospects = client.get("/prospects/", headers=auth)
    assert prospects.json() == []

    clients = client.get("/clients/", headers=auth)
    assert clients.status_code == 200
    assert any(c["id"] == data["client_id"] for c in clients.json())

    # Segunda finalização -> 409
    fin2 = client.post(f"/contracts/{contract['id']}/finalize", headers=auth)
    assert fin2.status_code == 409

    # Novo contrato para o mesmo prospecto -> 404 (não está mais ativo)
    regen = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    )
    assert regen.status_code == 404


def test_delete_draft_ok_and_finalized_forbidden(client):
    email = f"del_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    contract = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()

    resp_del = client.delete(f"/contracts/{contract['id']}", headers=auth)
    assert resp_del.status_code == 204
    assert client.get("/contracts/", headers=auth).json() == []

    contract2 = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()
    client.post(f"/contracts/{contract2['id']}/finalize", headers=auth)
    resp_del2 = client.delete(f"/contracts/{contract2['id']}", headers=auth)
    assert resp_del2.status_code == 409


def test_contracts_endpoints_require_authentication(client):
    assert client.get("/contracts/").status_code == 401
    assert client.get("/contracts/templates").status_code == 401
    assert client.post("/contracts/generate", json={}).status_code == 401
    assert client.post(f"/contracts/{uuid4()}/finalize").status_code == 401
