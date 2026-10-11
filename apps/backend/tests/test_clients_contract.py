"""Contrato de `GET/POST/PUT /clients/` (regra §6 da release R2).

O `ClientResponse` herdava de `ClientBase` e acrescentava `user_id`,
`created_at` e `updated_at` — três chaves que nenhum componente lê: a tela de
empresas mostra nome, documento, contato e endereço, e a posse do registro já
vem implícita no fato de o endpoint só devolver as empresas do próprio usuário.

`user_id` ainda é pior que inútil no payload: ele é o dono da empresa, ou seja,
um identificador interno de outra entidade. Quanto mais tempo ele viaja na
resposta, mais fácil um consumidor novo passar a confiar nele como se fosse uma
autorização — e não é.

O teste fecha o payload chave por chave nos três verbos, pelo mesmo motivo de
`test_deal_payload_keys_match_the_governance_zod_schema`: o Zod do frontend é
`.strict()`, então uma chave a mais derruba a tela inteira, e uma chave a menos
some em silêncio.
"""

from uuid import uuid4

from tests.helpers import auth_header, unique_email

# Campos que o backend entrega e que o `clientSchema` do frontend declara.
EXPECTED_CLIENT_KEYS = {
    "id",
    "name",
    "cnpj",
    "phone",
    "email",
    "color",
    "description",
    "segment",
    "street",
    "number",
    "complement",
    "neighborhood",
    "city",
    "state",
    "cep",
}


def test_list_clients_payload_has_no_internal_columns(client):
    """A listagem entrega só o que a tela de empresas renderiza."""
    headers = auth_header(client, unique_email("clientes-lista"))
    resp = client.post(
        "/clients/",
        json={"name": "Empresa Listada", "email": "listada@exemplo.com"},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text

    resp = client.get("/clients/", headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    assert set(data[0]) == EXPECTED_CLIENT_KEYS


def test_create_client_payload_has_no_internal_columns(client):
    """O cadastro devolve o mesmo contrato da listagem."""
    headers = auth_header(client, unique_email("clientes-create"))
    resp = client.post(
        "/clients/",
        json={"name": "Empresa Criada", "email": "criada@exemplo.com"},
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    assert set(resp.json()) == EXPECTED_CLIENT_KEYS


def test_update_client_payload_has_no_internal_columns(client):
    """A edição devolve o mesmo contrato da listagem."""
    headers = auth_header(client, unique_email("clientes-update"))
    created = client.post(
        "/clients/",
        json={"name": "Empresa Editada", "email": "editada@exemplo.com"},
        headers=headers,
    )
    assert created.status_code in (200, 201), created.text

    resp = client.put(
        f"/clients/{created.json()['id']}",
        json={"name": "Empresa Editada Novo"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    assert set(resp.json()) == EXPECTED_CLIENT_KEYS
    assert resp.json()["name"] == "Empresa Editada Novo"


def test_client_response_keeps_the_fields_the_screen_reads(client):
    """A faxina não pode levá-lo junto o que a tela mostra."""
    headers = auth_header(client, unique_email("clientes-campos"))
    resp = client.post(
        "/clients/",
        json={
            "name": "Empresa Completa",
            "cnpj": "11222333000181",
            "segment": "Financeiro",
            "city": "São Paulo",
            "state": "SP",
            "email": "completa@exemplo.com",
        },
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    data = resp.json()
    assert data["name"] == "Empresa Completa"
    assert data["segment"] == "Financeiro"
    assert data["city"] == "São Paulo"
    assert data["state"] == "SP"
    assert data["email"] == "completa@exemplo.com"


def test_create_client_still_rejects_the_removed_keys_silently(client):
    """Campos de auditoria não entram no payload — nem no contrato do request.

    O `ClientCreate` é `ClientBase` sem eles, então mandá-los é apenas ignorado
    (regra de validação da borda: o servidor não desconhece o que o cliente
    inventou). O teste fixa que a resposta não os devolve de volta.
    """
    headers = auth_header(client, unique_email("clientes-extras"))
    resp = client.post(
        "/clients/",
        json={
            "name": "Empresa Com Extras",
            "user_id": str(uuid4()),
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        },
        headers=headers,
    )
    assert resp.status_code in (200, 201), resp.text
    assert set(resp.json()) == EXPECTED_CLIENT_KEYS
