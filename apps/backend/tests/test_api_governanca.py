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
        "city": "São Paulo",
        "state": "SP",
        **overrides,
    }
    return client.post("/prospects/", json=payload, headers=auth)


def create_proposal(client, auth, prospect, final_price=2500.0):
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
        "result_payload": {"final_price": final_price},
        "prospect_id": prospect["id"],
    }
    return client.post("/proposals/", json=payload, headers=auth)


def generate_contract(client, auth, prospect, proposal=None):
    body = {"prospect_id": prospect["id"]}
    if proposal is not None:
        body["proposal_id"] = proposal["id"]
    return client.post("/contracts/generate", json=body, headers=auth)


def get_deals(client, auth):
    resp = client.get("/governanca/deals", headers=auth)
    assert resp.status_code == 200
    return resp.json()


def test_deals_grouped_by_status(client):
    email = f"gov_status_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    conquistado = create_prospect(client, auth, name="Ganhou Negócio").json()
    client.post(f"/prospects/{conquistado['id']}/convert", headers=auth)

    perdido = create_prospect(client, auth, name="Perdeu Negócio").json()
    client.post(f"/prospects/{perdido['id']}/reprove", headers=auth)

    create_prospect(client, auth, name="Em Negociação")

    data = get_deals(client, auth)
    assert data["months"]
    by_id = {d["id"]: d for d in data["deals"]}

    assert by_id[conquistado["id"]]["status"] == "conquistado"
    assert by_id[perdido["id"]]["status"] == "perdido"

    negociacao = next(d for d in data["deals"] if d["name"] == "Em Negociação")
    assert negociacao["status"] == "em_negociacao"


def test_conquistado_deal_timeline_and_links(client):
    email = f"gov_win_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Cliente Fechado").json()
    proposal = create_proposal(client, auth, prospect, final_price=3300.0).json()
    contract = generate_contract(client, auth, prospect, proposal).json()
    client.post(f"/contracts/{contract['id']}/finalize", headers=auth)

    data = get_deals(client, auth)
    deal = next(d for d in data["deals"] if d["id"] == prospect["id"])

    assert deal["status"] == "conquistado"
    assert deal["client_id"] is not None
    assert deal["proposal"]["id"] == proposal["id"]
    assert deal["proposal"]["final_price"] == 3300.0
    assert deal["contract"]["id"] == contract["id"]
    assert deal["contract"]["status"] == "finalized"
    assert deal["contract"]["number"] == contract["number"]

    types = [t["type"] for t in deal["timeline"]]
    assert "created" in types
    assert "sent" in types
    assert "approved" in types
    approved = next(t for t in deal["timeline"] if t["type"] == "approved")
    assert approved["date"] is not None


def test_perdido_deal_timeline(client):
    email = f"gov_lost_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Perdeu").json()
    client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)

    deal = next(
        d for d in get_deals(client, auth)["deals"] if d["id"] == prospect["id"]
    )

    assert deal["status"] == "perdido"
    types = [t["type"] for t in deal["timeline"]]
    assert "rejected" in types
    assert "approved" not in types
    rejected = next(t for t in deal["timeline"] if t["type"] == "rejected")
    assert rejected["date"] is not None


def test_negociacao_deal_has_pending_mock(client):
    email = f"gov_pend_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Pendente").json()

    deal = next(
        d for d in get_deals(client, auth)["deals"] if d["id"] == prospect["id"]
    )

    assert deal["status"] == "em_negociacao"
    types = [t["type"] for t in deal["timeline"]]
    assert "pending" in types
    assert "approved" not in types
    pending = next(t for t in deal["timeline"] if t["type"] == "pending")
    assert pending["mock"] is True
    assert pending["date"] is None


def test_negociacao_timeline_shows_full_client_decision_flow(client):
    email = f"gov_flow_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Fluxo de Aprovação").json()
    proposal = create_proposal(client, auth, prospect).json()

    link = client.post(f"/proposals/{proposal['id']}/share-link", headers=auth).json()
    share_hash = link["url"].rsplit("/", 1)[-1]

    client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "changes", "observation": "Reduzir escopo"},
    )
    client.post(
        f"/proposals/public/{share_hash}/decision",
        json={"decision": "approved", "observation": "Fechado"},
    )

    deal = next(
        d for d in get_deals(client, auth)["deals"] if d["id"] == prospect["id"]
    )

    assert deal["status"] == "em_negociacao"
    types = [t["type"] for t in deal["timeline"]]
    assert "pending" not in types
    assert "changes" in types
    assert "approved" in types
    assert types.index("changes") < types.index("approved")

    changes_evt = next(t for t in deal["timeline"] if t["type"] == "changes")
    assert changes_evt["date"] is not None


def test_proposals_list_hides_converted_linked(client):
    email = f"gov_hide_prop_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()
    proposal = create_proposal(client, auth, prospect).json()

    client.post(f"/prospects/{prospect['id']}/convert", headers=auth)

    listed = client.get("/proposals/", headers=auth).json()
    assert all(p["id"] != proposal["id"] for p in listed)

    # Detalhe continua acessível (exportar / visualizar via Governança)
    detail = client.get(f"/proposals/{proposal['id']}", headers=auth)
    assert detail.status_code == 200


def test_contracts_list_hides_finalized(client):
    email = f"gov_hide_ctr_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()
    contract = generate_contract(client, auth, prospect).json()

    listed = client.get("/contracts/", headers=auth).json()
    assert any(c["id"] == contract["id"] for c in listed)

    client.post(f"/contracts/{contract['id']}/finalize", headers=auth)

    listed = client.get("/contracts/", headers=auth).json()
    assert all(c["id"] != contract["id"] for c in listed)

    # Detalhe do contrato finalizado continua acessível
    detail = client.get(f"/contracts/{contract['id']}", headers=auth)
    assert detail.status_code == 200
    assert detail.json()["status"] == "finalized"
