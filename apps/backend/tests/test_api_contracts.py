from uuid import uuid4

from src.modules.contracts.default_template import DEFAULT_TEMPLATE_SECTIONS
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


def test_get_template_creates_default_model(client):
    email = f"tmpl_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)

    resp = client.get("/contracts/templates", headers=auth)

    assert resp.status_code == 200
    sections = resp.json()["sections"]
    assert sections == DEFAULT_TEMPLATE_SECTIONS
    assert len(sections) == 15
    assert any(
        s["title"] == "CLÁUSULA PRIMEIRA - DO OBJETO DO CONTRATO" for s in sections
    )


def test_get_template_same_user_returns_cached_model(client):
    email = f"tmpl_cache_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)

    first = client.get("/contracts/templates", headers=auth).json()["sections"]
    second = client.get("/contracts/templates", headers=auth).json()["sections"]
    assert first == second == DEFAULT_TEMPLATE_SECTIONS


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


def test_generate_default_model_replaces_contractada_tokens(client):
    email = f"gen_cont_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    client.patch(
        "/auth/me",
        json={
            "name": "Raul Gomes",
            "company_name": "Café Com BPO Ltda",
            "company_cnpj": "00112233000144",
            "company_address": "Rua das Flores, 100 - Centro, São Paulo - SP",
            "company_professional_email": "contato@cafecombpo.com.br",
        },
        headers=auth,
    )
    prospect = _create_prospect(client, auth).json()
    proposal = _create_proposal(client, auth, prospect, final_price=1250.0).json()

    resp = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    )

    assert resp.status_code == 201
    sections = resp.json()["sections"]

    head = next(s for s in sections if s["title"] == "CONTRATADA E CONTRATANTE")[
        "content"
    ]
    assert "Café Com BPO Ltda" in head
    assert "00112233000144" in head
    assert "Rua das Flores" in head
    assert "Raul Gomes" in head
    assert "Empresa Contrato" in head
    assert "{{cpf_contratada}}" in head
    assert "{{socio_contratante}}" in head

    valores = next(s for s in sections if s["title"].startswith("CLÁUSULA SÉTIMA"))[
        "content"
    ]
    assert "R$ 1.250,00" in valores
    assert "mil e duzentos e cinquenta reais" in valores

    lgpd = next(
        s for s in sections if s["title"].startswith("CLÁUSULA DÉCIMA SEGUNDA")
    )["content"]
    assert "contato@cafecombpo.com.br" in lgpd


def test_generate_renders_contracted_services_table(client):
    email = f"gen_srv_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    proposal = client.post(
        "/proposals/",
        json={
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
                "services": [
                    {
                        "name": "Implantação e Treinamento",
                        "minutes_per_execution": 60,
                        "monthly_quantity": 10,
                        "active": True,
                    },
                    {
                        "name": "Controle de contas pagar e a receber",
                        "minutes_per_execution": 30,
                        "monthly_quantity": 5,
                        "active": True,
                    },
                    {
                        "name": "Cobrança ativa",
                        "type": "fixed",
                        "fixed_value": 1500,
                        "monthly_quantity": 1,
                        "active": False,
                    },
                ],
            },
            "result_payload": {
                "final_price": 1250.0,
                "price_before_discount": 1388.89,
                "discount_amount": 138.89,
                "breakdown": {
                    "cost_per_minute": 0.5,
                    "service_costs": [300.0, 75.0, 1500.0],
                    "total_service_cost": 375.0,
                },
            },
            "prospect_id": prospect["id"],
        },
        headers=auth,
    ).json()

    resp = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    )

    assert resp.status_code == 201
    valores = next(
        s for s in resp.json()["sections"] if s["title"].startswith("CLÁUSULA SÉTIMA")
    )["content"]
    assert "| Item | Descrição | Limite do Plano |" in valores
    assert "| Plano | Plano contratado | Básico |" in valores
    assert "| Contas Bancárias | Contas para conciliação | Até 2 contas |" in valores
    assert (
        "| Nº | Serviço contratado | Valor do serviço | Quantidade | Total do serviço |"
        in valores
    )
    assert "| 1 | Implantação e Treinamento | R$ 100,00 | 10 | R$ 1.000,00 |" in valores
    assert (
        "| 2 | Controle de contas pagar e a receber | R$ 50,00 | 5 | R$ 250,00 |"
        in valores
    )
    assert "| **Total dos serviços** | | | | **R$ 1.250,00** |" in valores
    assert "Cobrança ativa" not in valores


def test_generate_resolves_document_date_tokens(client):
    from datetime import datetime
    from zoneinfo import ZoneInfo

    email = f"gen_dt_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth, name="Datado").json()

    resp = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    )

    assert resp.status_code == 201
    content = "\n".join(s["content"] for s in resp.json()["sections"])
    assert "{{dia}}" not in content
    assert "{{mes}}" not in content
    assert "{{ano}}" not in content
    today = datetime.now(ZoneInfo("America/Sao_Paulo"))
    assert f"{today.day} de" in content
    assert str(today.year) in content


def test_generate_keeps_unresolved_tokens_literal(client):
    email = f"gen_lit_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    resp = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    )

    assert resp.status_code == 201
    sections = resp.json()["sections"]
    head = sections[0]["content"]
    assert "{{empresa_contratada}}" in head
    assert "{{cnpj_contratada}}" in head
    valores = next(s for s in sections if s["title"].startswith("CLÁUSULA SÉTIMA"))[
        "content"
    ]
    assert "{{valor_mensal}}" in valores


def test_valor_por_extenso():
    from src.modules.contracts.service import valor_por_extenso

    assert valor_por_extenso(1250.0) == "mil e duzentos e cinquenta reais"
    assert valor_por_extenso(0) == "zero reais"
    assert valor_por_extenso(1) == "um real"
    assert valor_por_extenso(0.05) == "cinco centavos"
    assert valor_por_extenso(2.35) == "dois reais e trinta e cinco centavos"


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


def test_preview_resolves_tokens_with_current_data(client):
    email = f"prev_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth, name="Empresa Visualizar").json()
    proposal = _create_proposal(client, auth, prospect, final_price=2500.0).json()
    contract = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    ).json()

    # Preenche o perfil só depois da geração e reintroduz as variáveis nas seções
    client.patch(
        "/auth/me",
        json={
            "name": "Raul Gomes",
            "company_name": "Café Com BPO Ltda",
            "company_cnpj": "00112233000144",
            "company_address": "Rua das Flores, 100 - São Paulo - SP",
            "company_professional_email": "contato@cafecombpo.com.br",
        },
        headers=auth,
    )
    client.patch(
        f"/contracts/{contract['id']}",
        json={
            "sections": [
                {
                    "title": "Das Partes",
                    "content": (
                        "Contratada {{empresa_contratada}} ({{cnpj_contratada}}) "
                        "e Contratante {{nome}}, CNPJ {{cnpj}}, cpf pendente "
                        "{{cpf_contratada}}."
                    ),
                },
                {
                    "title": "Do Objeto",
                    "content": "Por {{valor_mensal}}, {{valor_mensal_extenso}}",
                },
            ]
        },
        headers=auth,
    )

    resp = client.get(f"/contracts/{contract['id']}/preview", headers=auth)

    assert resp.status_code == 200
    sections = resp.json()["sections"]
    parte = sections[0]["content"]
    assert "Café Com BPO Ltda" in parte
    assert "00112233000144" in parte
    assert "Empresa Visualizar" in parte
    assert "12345678000199" in parte
    assert "{{cpf_contratada}}" in parte

    objeto = sections[1]["content"]
    assert "R$ 2.500,00" in objeto
    assert "dois mil e quinhentos reais" in objeto


def test_preview_unknown_contract_returns_404(client):
    email = f"prev_404_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    resp = client.get(f"/contracts/{uuid4()}/preview", headers=auth)
    assert resp.status_code == 404


def test_preview_requires_authentication(client):
    assert client.get(f"/contracts/{uuid4()}/preview").status_code == 401
