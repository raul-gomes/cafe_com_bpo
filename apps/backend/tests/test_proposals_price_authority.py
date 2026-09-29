"""Autoridade do preço do orçamento: o backend recalcula, o cliente não decide.

Regressão de segurança: o preço persistido nascia no navegador — o frontend
enviava `result_payload` e o backend gravava verbatim. Um body adulterado
trocava o valor de um orçamento. Aqui o preço é sempre derivado do
`input_payload` pela Metodologia v4 do servidor.
"""

from tests.helpers import (
    auth_header,
    unique_email,
    valid_pricing_input,
    valid_proposal_payload,
)

EXPECTED_FINAL_PRICE = 25.0
TAMPERED = {"final_price": 1, "price_before_discount": 1, "discount_amount": 0}


def test_create_stores_server_calculated_price(client):
    auth = auth_header(client, unique_email("preco"))
    resp = client.post("/proposals/", json=valid_proposal_payload(), headers=auth)

    assert resp.status_code == 201, resp.text
    assert resp.json()["result_payload"]["final_price"] == EXPECTED_FINAL_PRICE


def test_create_ignores_tampered_result_payload(client):
    auth = auth_header(client, unique_email("preco"))
    resp = client.post(
        "/proposals/",
        json=valid_proposal_payload(result_payload=TAMPERED),
        headers=auth,
    )

    assert resp.status_code == 201, resp.text
    stored = client.get(f"/proposals/{resp.json()['id']}", headers=auth).json()
    assert stored["result_payload"]["final_price"] == EXPECTED_FINAL_PRICE


def test_create_applies_commission_and_term_discount_from_the_input(client):
    auth = auth_header(client, unique_email("preco"))
    resp = client.post(
        "/proposals/",
        json=valid_proposal_payload(
            input_payload=valid_pricing_input(
                margin=0.2, tax_rate=6, commission_rate=4, term_discount=0.1
            )
        ),
        headers=auth,
    )

    # 25.00 de custo + 20% de lucro = 30.00; /0,90 = 33,33; -10% = 30,00
    assert resp.json()["result_payload"]["final_price"] == 30.0
    assert resp.json()["result_payload"]["discount_amount"] == 3.33


def test_create_stores_breakdown_with_service_identity(client):
    auth = auth_header(client, unique_email("preco"))
    resp = client.post("/proposals/", json=valid_proposal_payload(), headers=auth)

    service_costs = resp.json()["result_payload"]["breakdown"]["service_costs"]
    assert service_costs == [
        {
            "name": "Atendimento",
            "type": "time",
            "cost": 25.0,
            "monthly_quantity": 5,
        }
    ]


def test_create_rejects_unusable_input_payload(client):
    auth = auth_header(client, unique_email("preco"))
    resp = client.post(
        "/proposals/",
        json=valid_proposal_payload(input_payload={}),
        headers=auth,
    )

    assert resp.status_code == 400
    assert client.get("/proposals/", headers=auth).json() == []


def test_create_rejects_markup_that_reaches_one_hundred_percent(client):
    auth = auth_header(client, unique_email("preco"))
    resp = client.post(
        "/proposals/",
        json=valid_proposal_payload(
            input_payload=valid_pricing_input(tax_rate=95, commission_rate=10)
        ),
        headers=auth,
    )

    assert resp.status_code == 400


def test_update_recalculates_and_ignores_tampered_result_payload(client):
    auth = auth_header(client, unique_email("preco"))
    created = client.post(
        "/proposals/", json=valid_proposal_payload(), headers=auth
    ).json()

    resp = client.put(
        f"/proposals/{created['id']}",
        json=valid_proposal_payload(
            client_name="Cliente do Teste",
            input_payload=valid_pricing_input(margin=1),
            result_payload=TAMPERED,
        ),
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["result_payload"]["final_price"] == 50.0


def test_public_link_exposes_the_server_calculated_price(client):
    auth = auth_header(client, unique_email("preco"))
    created = client.post(
        "/proposals/",
        json=valid_proposal_payload(result_payload=TAMPERED),
        headers=auth,
    ).json()
    link = client.post(f"/proposals/{created['id']}/share-link", headers=auth).json()

    public = client.get(f"/proposals/public/{link['url'].rsplit('/', 1)[-1]}")
    assert public.status_code == 200
    assert public.json()["result_payload"]["final_price"] == EXPECTED_FINAL_PRICE
