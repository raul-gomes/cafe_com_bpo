"""Saving billing data straight from the payments screen (§17.8).

`PUT /subscriptions/billing` is how the payments page form saves: document and
address, no checkout required. Three properties are guarded here:

1. **The answer is the eight fields the form reads** — §6 ships nothing the
   screen does not render, and the key set is the contract.
2. **The values are normalized on the way in** (digits-only phone/document/CEP,
   upper-case state): Asaas refuses a masked phone with a message blaming a
   missing field, and a bad document only surfaces at payment confirmation.
3. **The upsert is keyed by user** — a save can never read, append to or be
   visible from another account (§17.7).
"""

from tests.helpers import auth_header, unique_email

VALID_BILLING = {
    "cpf_cnpj": "24971563792",
    "phone": "(47) 3801-0919",
    "address": "Av. Paulista",
    "address_number": "150",
    "city": "São Paulo",
    "state": "sp",
    "postal_code": "01310-000",
}

FORM_KEYS = {
    "cpf_cnpj",
    "phone",
    "address",
    "address_number",
    "complement",
    "city",
    "state",
    "postal_code",
}


def test_saving_billing_data_returns_exactly_the_fields_the_form_reads(client):
    """The response key set is the contract with the screen (§6).

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the status and the exact keys.
    """
    auth = auth_header(client, unique_email("billing"))

    response = client.put("/subscriptions/billing", json=VALID_BILLING, headers=auth)

    assert response.status_code == 200, response.text
    assert set(response.json()) == FORM_KEYS


def test_saved_billing_data_prefills_the_form(client):
    """The save is a write, not an echo: a later GET returns what was stored.

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the persisted values.
    """
    auth = auth_header(client, unique_email("billing"))

    client.put("/subscriptions/billing", json=VALID_BILLING, headers=auth)
    saved = client.get("/subscriptions/billing", headers=auth)

    assert saved.status_code == 200, saved.text
    assert saved.json() == {
        "cpf_cnpj": "24971563792",
        "phone": "4738010919",
        "address": "Av. Paulista",
        "address_number": "150",
        "complement": None,
        "city": "São Paulo",
        "state": "SP",
        "postal_code": "01310000",
    }


def test_saving_billing_data_rejects_an_invalid_document(client):
    """A bad CPF would only surface at payment confirmation (§17.8).

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the 422.
    """
    auth = auth_header(client, unique_email("billing"))
    payload = {**VALID_BILLING, "cpf_cnpj": "11111111111"}

    response = client.put("/subscriptions/billing", json=payload, headers=auth)

    assert response.status_code == 422, response.text


def test_saving_billing_data_refuses_unknown_fields(client):
    """A silently dropped field is one the form believes was saved (`extra="forbid"`).

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the 422.
    """
    auth = auth_header(client, unique_email("billing"))
    payload = {**VALID_BILLING, "pix_key": "anyone@example.com"}

    response = client.put("/subscriptions/billing", json=payload, headers=auth)

    assert response.status_code == 422, response.text


def test_saving_billing_data_requires_authentication(client):
    """Document and address are personal data: anonymous writes stop at the boundary.

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the 401.
    """
    response = client.put("/subscriptions/billing", json=VALID_BILLING)

    assert response.status_code == 401


def test_billing_data_of_one_person_is_invisible_to_another(client):
    """The profile is keyed by user: a second save neither appends nor overwrites.

    Args:
        client: FastAPI test client.

    Returns:
        None. Asserts the stranger sees 404 and the owner still sees their data.
    """
    owner = auth_header(client, unique_email("billing"))
    stranger = auth_header(client, unique_email("billing"))

    client.put("/subscriptions/billing", json=VALID_BILLING, headers=owner)

    other = client.get("/subscriptions/billing", headers=stranger)
    mine = client.get("/subscriptions/billing", headers=owner)

    assert other.status_code == 404, other.text
    assert mine.status_code == 200, mine.text
    assert mine.json()["cpf_cnpj"] == VALID_BILLING["cpf_cnpj"]
