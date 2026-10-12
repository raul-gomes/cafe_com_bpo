"""AUD-021: sending null for an optional field removes the stored value."""

from tests.helpers import paid_auth_header, unique_email


def test_client_update_with_null_clears_the_fields(client):
    auth = paid_auth_header(client, unique_email("clear_client"))
    created = client.post(
        "/clients/",
        json={
            "name": "Padaria",
            "phone": "11987654321",
            "email": "a@padaria.com.br",
            "city": "Campinas",
        },
        headers=auth,
    ).json()

    resp = client.put(
        f"/clients/{created['id']}",
        json={"name": "Padaria", "phone": None, "email": None, "city": None},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    stored = next(
        c
        for c in client.get("/clients/", headers=auth).json()
        if c["id"] == created["id"]
    )
    assert (stored["phone"], stored["email"], stored["city"]) == (None, None, None)


def test_prospect_update_with_null_clears_the_fields(client):
    auth = paid_auth_header(client, unique_email("clear_prospect"))
    created = client.post(
        "/prospects/",
        json={"name": "Lead", "cnpj": "12345678000199", "representante_nome": "Ana"},
        headers=auth,
    ).json()

    resp = client.put(
        f"/prospects/{created['id']}",
        json={"name": "Lead", "cnpj": None, "representante_nome": None},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    stored = next(
        p
        for p in client.get("/prospects/", headers=auth).json()
        if p["id"] == created["id"]
    )
    assert (stored["cnpj"], stored["representante_nome"]) == (None, None)
