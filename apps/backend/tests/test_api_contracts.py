from uuid import uuid4

from src.modules.contracts.default_template import DEFAULT_TEMPLATE_SECTIONS
from src.modules.contracts.fields import SERVICO_RECORRENTE
from tests.helpers import register_user

SERVICO_KEY = SERVICO_RECORRENTE


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
    assert len(sections) == 17
    assert any(s["title"] == "CLÁUSULA PRIMEIRA – DO OBJETO" for s in sections)


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
    assert "{{contratada_representante_cpf}}" not in head

    valores = next(s for s in sections if s["title"].startswith("CLÁUSULA SÉTIMA"))[
        "content"
    ]
    assert "R$ 1.250,00" in valores
    assert "mil e duzentos e cinquenta reais" in valores

    comunicacoes = next(
        s for s in sections if s["title"].startswith("CLÁUSULA DÉCIMA PRIMEIRA")
    )["content"]
    assert "contato@cafecombpo.com.br" in comunicacoes


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
    anexo = next(
        s for s in resp.json()["sections"] if s["title"].startswith("ANEXO I")
    )["content"]
    assert "| SERVIÇO | FREQUÊNCIA | PRAZO DE ENTREGA |" in anexo
    assert "| Implantação e Treinamento | 10x/mês |" in anexo
    assert "| Controle de contas pagar e a receber | 5x/mês |" in anexo
    assert "| ITEM | LIMITE MENSAL |" in anexo
    assert "| Implantação e Treinamento | 10 |" in anexo
    assert "| Controle de contas pagar e a receber | 5 |" in anexo
    assert "Cobrança ativa" not in anexo


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
    content = "\n".join(s["content"] for s in resp.json()["sections"])

    # Sem perfil de contratada preenchido, os tokens de endereço ficam vazios
    # (não literais) e os blocos opcionais sem valor são removidos.
    assert "{{contratada_razao_social}}" not in content
    assert "{{contratada_endereco}}" not in content
    # Sem orçamento vinculado, o token de valor mensal permanece literal.
    assert "{{valor_mensal}}" in content
    # Bloco opcional sem valor (testemunhas / implantação) é removido.
    assert "TESTEMUNHAS" not in content
    assert "7.6. Pela implantação" not in content


def test_valor_por_extenso():
    from src.modules.contracts.service import valor_por_extenso

    assert valor_por_extenso(1250.0) == "mil e duzentos e cinquenta reais"
    assert valor_por_extenso(0) == "zero reais"
    assert valor_por_extenso(1) == "um real"
    assert valor_por_extenso(0.05) == "cinco centavos"
    assert valor_por_extenso(2.35) == "dois reais e trinta e cinco centavos"


def test_missing_fields_lists_modal_field_descriptors(client):
    email = f"mf_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    proposal = _create_proposal(client, auth, prospect).json()

    resp = client.post(
        "/contracts/missing-fields",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] == len(data["fields"])
    keys = {f["key"] for f in data["fields"]}
    # Campos sem valor pré-preenchido continuam sendo solicitados
    assert "sistema_gestao" in keys
    assert "foro_comarca" in keys
    assert "testemunhas" in keys
    # Campos com default preenchido (Operação / Financeiro e prazo) não são
    # pedidos — o usuário ajusta diretamente no contrato.
    assert "dia_vencimento" not in keys
    assert "data_inicio" not in keys
    assert "horario_atendimento" not in keys
    assert "prazo_minimo_meses" not in keys
    assert "autoriza_citacao_cliente" not in keys
    # Serviços e volumes vêm do orçamento — não são pedidos no modal.
    assert "volumes" not in keys
    assert SERVICO_KEY not in keys
    assert "servicos_pontuais" not in keys
    assert all(f.get("group") for f in data["fields"])


def _set_company_profile(client, auth, **overrides):
    profile = {
        "company_razao_social": "Café BPO Serviços Financeiros Ltda",
        "company_nome_fantasia": "Café BPO",
        "company_cnpj": "12.345.678/0001-99",
        "company_street": "Rua das Flores",
        "company_number": "100",
        "company_complement": "Sala 2",
        "company_neighborhood": "Centro",
        "company_city": "São Paulo",
        "company_state": "SP",
        "company_cep": "01310100",
        "company_professional_email": "contato@cafebpo.com",
    }
    profile.update(overrides)
    resp = client.patch("/auth/me", json=profile, headers=auth)
    assert resp.status_code == 200
    return resp.json()


def test_missing_fields_omits_contratada_address_when_profile_has_city_state_cep(
    client,
):
    email = f"mf_omits_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    _set_company_profile(client, auth)
    prospect = _create_prospect(client, auth).json()

    resp = client.post(
        "/contracts/missing-fields",
        json={"prospect_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 200
    keys = {f["key"] for f in resp.json()["fields"]}
    assert "contratada_cidade" not in keys
    assert "contratada_uf" not in keys
    assert "contratada_cep" not in keys
    # Sem fonte no perfil, continua sendo solicitado
    assert "contratada_representante_cargo" in keys
    assert "sistema_gestao" in keys


def test_missing_fields_keeps_contratada_address_when_profile_empty(client):
    email = f"mf_keeps_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    resp = client.post(
        "/contracts/missing-fields",
        json={"prospect_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 200
    keys = {f["key"] for f in resp.json()["fields"]}
    assert "contratada_cidade" in keys
    assert "contratada_uf" in keys
    assert "contratada_cep" in keys


def test_preview_pulls_structured_company_address_after_profile_update(client):
    email = f"pv_addr_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    client.put(
        "/contracts/templates",
        json={
            "sections": [
                {
                    "title": "Das Partes",
                    "content": (
                        "CONTRATADA: {{contratada_razao_social}}, "
                        "{{contratada_cnpj}}, {{contratada_endereco}}, "
                        "{{contratada_cidade}}/{{contratada_uf}}, "
                        "CEP {{contratada_cep}}"
                    ),
                }
            ]
        },
        headers=auth,
    )
    contract = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()

    _set_company_profile(client, auth)

    preview = client.get(f"/contracts/{contract['id']}/preview", headers=auth)

    assert preview.status_code == 200
    content = preview.json()["sections"][0]["content"]
    assert "Café BPO Serviços Financeiros Ltda" in content
    assert "12345678000199" in content
    assert "Rua das Flores, 100, Sala 2 - Centro" in content
    assert "São Paulo/SP" in content
    assert "CEP 01310100" in content


def test_missing_fields_omits_contratante_representante_when_prospect_has_them(client):
    email = f"mf_cont_rep_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    client.put(
        f"/prospects/{prospect['id']}",
        json={
            "representante_nome": "Maria Silva",
            "representante_cargo": "CFO",
            "representante_cpf": "12345678901",
        },
        headers=auth,
    )

    resp = client.post(
        "/contracts/missing-fields",
        json={"prospect_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 200
    keys = {f["key"] for f in resp.json()["fields"]}
    assert "contratante_representante_nome" not in keys
    assert "contratante_representante_cargo" not in keys
    assert "contratante_representante_cpf" not in keys
    assert "sistema_gestao" in keys


def test_missing_fields_keeps_contratante_representante_when_prospect_empty(client):
    email = f"mf_cont_rep2_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    resp = client.post(
        "/contracts/missing-fields",
        json={"prospect_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 200
    keys = {f["key"] for f in resp.json()["fields"]}
    assert "contratante_representante_nome" in keys
    assert "contratante_representante_cargo" in keys
    assert "contratante_representante_cpf" in keys


def test_generate_pulls_contratante_representante_from_prospect(client):
    email = f"gen_rep_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth, name="Contratante SA").json()
    client.put(
        f"/prospects/{prospect['id']}",
        json={
            "representante_nome": "Maria Silva",
            "representante_email": "maria@contratante.com",
            "representante_cpf": "12345678901",
            "representante_telefone": "11977771234",
            "representante_cargo": "CFO",
        },
        headers=auth,
    )
    client.put(
        "/contracts/templates",
        json={
            "sections": [
                {
                    "title": "Das Partes",
                    "content": (
                        "DEPOIS {{contratante_representante_nome}} "
                        "({{contratante_representante_cargo}}), CPF "
                        "{{contratante_representante_cpf}}, tel "
                        "{{contratante_representante_telefone}}, e-mail "
                        "{{contratante_representante_email}}"
                    ),
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
    assert "Maria Silva" in content
    assert "CFO" in content
    assert "12345678901" in content
    assert "11977771234" in content
    assert "maria@contratante.com" in content
    assert "{{contratante_representante_cpf}}" not in content


def test_generate_persists_fields_and_number(client):
    email = f"gen_f_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    fields = {
        "sistema_gestao": "Conta Azul",
        "dia_vencimento": "15",
        "data_inicio": "2026-10-01",
        "valor_implantacao": "1500,00",
        "autoriza_citacao_cliente": True,
    }
    resp = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "fields": fields},
        headers=auth,
    )

    assert resp.status_code == 201
    contract = resp.json()
    assert contract["number"] == 1
    assert contract["fields"]["sistema_gestao"] == "Conta Azul"

    content = "\n".join(s["content"] for s in contract["sections"])
    assert "Conta Azul" in content
    assert "vencimento no dia 15 de cada mês" in content
    assert "R$ 1.500,00" in content
    assert "mil e quinhentos reais" in content
    assert "7.6. Pela implantação" in content


def test_generate_removes_optional_block_when_field_empty(client):
    email = f"gen_opt_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    resp = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    )
    assert resp.status_code == 201
    valores = next(
        s for s in resp.json()["sections"] if s["title"].startswith("CLÁUSULA SÉTIMA")
    )["content"]
    assert "7.6. Pela implantação" not in valores


def test_generate_number_sequence_increments(client):
    email = f"gen_seq_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    first = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()
    second = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()

    assert first["number"] == 1
    assert second["number"] == 2
    assert "Contrato nº 0001" in "\n".join(s["content"] for s in first["sections"])
    assert "Contrato nº 0002" in "\n".join(s["content"] for s in second["sections"])


def test_patch_contract_fields_rerenders_sections(client):
    email = f"gen_patch_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()

    contract = client.post(
        "/contracts/generate", json={"prospect_id": prospect["id"]}, headers=auth
    ).json()

    patch = client.patch(
        f"/contracts/{contract['id']}/fields",
        json={"fields": {"sistema_gestao": "Omie"}},
        headers=auth,
    )

    assert patch.status_code == 200
    content = "\n".join(s["content"] for s in patch.json()["sections"])
    assert "| Sistema de gestão | Omie (licença: CONTRATANTE) |" in content
    assert patch.json()["fields"]["sistema_gestao"] == "Omie"


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
    assert client.post("/contracts/missing-fields", json={}).status_code == 401
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
                        "Contratada {{contratada_razao_social}} "
                        "({{contratada_cnpj}}) e Contratante {{nome}}, CNPJ "
                        "{{cnpj}}, representante CPF "
                        "{{contratada_representante_cpf}}."
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
    assert "{{contratada_representante_cpf}}" not in parte

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


def test_generate_composes_contratada_address_from_structured_fields(client):
    email = f"gen_addr_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    client.patch(
        "/auth/me",
        json={
            "name": "Raul Gomes",
            "company_name": "Café Com BPO Ltda",
            "company_cnpj": "00112233000144",
            "company_street": "Avenida Paulista",
            "company_number": "1000",
            "company_complement": "Sala 501",
            "company_neighborhood": "Bela Vista",
            "company_city": "São Paulo",
            "company_state": "SP",
            "company_cep": "01310100",
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
    head = next(
        s for s in resp.json()["sections"] if s["title"] == "CONTRATADA E CONTRATANTE"
    )["content"]
    assert "Avenida Paulista, 1000, Sala 501 - Bela Vista" in head
    assert "São Paulo/SP" in head
    assert "01310100" in head


def test_generate_contratada_address_falls_back_to_company_address(client):
    email = f"gen_legacy_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    client.patch(
        "/auth/me",
        json={
            "name": "Raul Gomes",
            "company_name": "Café Com BPO Ltda",
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
    head = next(
        s for s in resp.json()["sections"] if s["title"] == "CONTRATADA E CONTRATANTE"
    )["content"]
    assert "Rua das Flores" in head


def test_generate_pulls_implantacao_from_pontual_services(client):
    email = f"gen_imp_{uuid4()}@cafe.com"
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
                        "name": "Implantação do sistema",
                        "type": "fixed",
                        "fixed_value": 1000,
                        "monthly_quantity": 1,
                        "active": True,
                    },
                    {
                        "name": "Migração de dados",
                        "type": "fixed",
                        "fixed_value": 500,
                        "monthly_quantity": 1,
                        "active": True,
                    },
                    {
                        "name": "Controle de contas pagar e a receber",
                        "monthly_quantity": 5,
                        "active": True,
                    },
                ],
            },
            "result_payload": {
                "final_price": 1250.0,
                "breakdown": {"total_service_cost": 833.33},
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
    sections = resp.json()["sections"]
    valores = next(s for s in sections if s["title"].startswith("CLÁUSULA SÉTIMA"))[
        "content"
    ]
    assert "7.6. Pela implantação" in valores
    assert "R$ 1.500,00" in valores
    assert "mil e quinhentos reais" in valores

    anexo = next(s for s in sections if s["title"].startswith("ANEXO I"))["content"]
    assert "2. Serviços pontuais" in anexo
    assert "| Implantação do sistema |" in anexo
    assert "| Migração de dados |" in anexo


def test_generate_omits_implantacao_without_pontual_services(client):
    email = f"gen_imp2_{uuid4()}@cafe.com"
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
                        "name": "Controle de contas pagar e a receber",
                        "monthly_quantity": 5,
                        "active": True,
                    },
                ],
            },
            "result_payload": {
                "final_price": 1250.0,
                "breakdown": {"total_service_cost": 833.33},
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
    assert "7.6. Pela implantação" not in valores


def test_missing_fields_omits_contratada_representante_cargo_when_profile_has_cargo(
    client,
):
    email = f"mf_cargo_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    profile = _set_company_profile(client, auth, representante_cargo="Sócio")
    assert profile.get("representante_cargo") == "Sócio"
    prospect = _create_prospect(client, auth).json()

    resp = client.post(
        "/contracts/missing-fields",
        json={"prospect_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 200
    keys = {f["key"] for f in resp.json()["fields"]}
    assert "contratada_representante_cargo" not in keys


def test_generate_uses_representante_cargo_from_profile(client):
    email = f"gen_cargo_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    _set_company_profile(client, auth, representante_cargo="Sócio Diretor")
    prospect = _create_prospect(client, auth).json()
    proposal = _create_proposal(client, auth, prospect).json()

    resp = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"], "proposal_id": proposal["id"]},
        headers=auth,
    )

    assert resp.status_code == 201
    head = next(
        s for s in resp.json()["sections"] if s["title"] == "CONTRATADA E CONTRATANTE"
    )["content"]
    assert "Sócio Diretor" in head


def test_generate_uses_prospect_city_in_signature(client):
    email = f"gen_cidade_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    prospect = _create_prospect(client, auth).json()
    assert prospect["city"] == "São Paulo"

    resp = client.post(
        "/contracts/generate",
        json={"prospect_id": prospect["id"]},
        headers=auth,
    )

    assert resp.status_code == 201
    assinaturas = next(
        s for s in resp.json()["sections"] if s["title"] == "ASSINATURAS"
    )["content"]
    assert "São Paulo, " in assinaturas
