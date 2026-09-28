"""Gestão de Contatos: agenda de contatos do BPO.

A listagem é uma UNIÃO de três fontes, sem duplicar dado:

1. contatos livres (tabela `contacts`, cadastrados pelo próprio BPO);
2. o contato do PROSPECTO — o representante registrado em
   `prospects.representante_*` (mesmo prospecto ainda não convertido);
3. o contato do CLIENTE — o mesmo representante, do prospecto que originou o
   cliente (`converted_client_id`).

Regras confirmadas pelo dono do produto em 2026-09-28:

- prospecto não convertido NÃO some: o contato dele aparece e é editável;
- prospecto/cliente ARQUIVADO (soft delete) continua aparecendo;
- empresa SEM representante nomeado aparece usando telefone/e-mail do
  próprio cadastro, marcada como "sem pessoa cadastrada" (`tem_pessoa=False`)
  e sem edição por aqui (a pessoa é cadastrada no cadastro da empresa);
- editar uma linha de prospecto/cliente grava em `prospects.representante_*`
  (fonte única) e o nome da empresa pertence ao cadastro, logo não é editável
  por aqui;
- excluir só existe para contato livre.
"""

from uuid import UUID, uuid4

from tests.helpers import register_user


def auth_for(client, name="Bpo User"):
    email = f"bpo_{uuid4()}@cafe.com"
    register_user(
        payload={"email": email, "password": "StrongPassword123!", "name": name}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return {"Authorization": f"Bearer {token}", "uid": me["id"], "email": me["email"]}


def make_client_contact(
    client,
    auth,
    empresa="Contabilidade Alfa",
    nome="Marina Reis",
    telefone="(11) 98877-1234",
    email="marina@alfa.com.br",
):
    """Cria um prospecto com representante, converte em cliente e devolve os ids."""
    prospect = client.post(
        "/prospects/",
        json={
            "name": empresa,
            "phone": "(11) 3333-4444",
            "email": "contato@alfa.com.br",
            "representante_nome": nome,
            "representante_telefone": telefone,
            "representante_email": email,
        },
        headers=auth,
    )
    assert prospect.status_code == 201, prospect.text
    prospect_id = prospect.json()["id"]
    converted = client.post(f"/prospects/{prospect_id}/convert", headers=auth)
    assert converted.status_code in (200, 201), converted.text
    return prospect_id, converted.json()["client_id"]


def make_prospect(
    client,
    auth,
    empresa="Lead Aberto Ltda",
    nome="Lead Ainda Não é Cliente",
    telefone="(21) 3222-1111",
    email="lead@aberto.com.br",
    representante="Nina Prospecto",
):
    """Prospecto em aberto (não convertido) e devolve o id.

    `representante=None` cria o cadastro SEM pessoa nomeada.
    """
    body = {
        "name": empresa,
        "phone": telefone,
        "email": email,
    }
    if representante is not None:
        body["representante_nome"] = nome
        body["representante_telefone"] = telefone
        body["representante_email"] = email
    resp = client.post("/prospects/", json=body, headers=auth)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def read_prospect(prospect_id):
    """Lê o prospecto direto no banco (a listagem de prospects esconde convertido)."""
    from src.core.database import SessionLocal
    from src.modules.prospects.models import Prospect

    session = SessionLocal()
    try:
        return session.query(Prospect).filter(Prospect.id == UUID(prospect_id)).first()
    finally:
        session.close()


def list_contacts(client, auth, **params):
    resp = client.get("/contacts/", params=params, headers=auth)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── contatos livres ──


def test_create_contact_returns_the_new_row(client):
    auth = auth_for(client)

    resp = client.post(
        "/contacts/",
        json={
            "nome": "João Batista",
            "telefone": "(21) 99876-1122",
            "email": "joao@empresa.com.br",
            "empresa": "Empresa Beta",
        },
        headers=auth,
    )

    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["nome"] == "João Batista"
    assert body["empresa"] == "Empresa Beta"
    assert body["origem"] == "livre"
    assert body["telefone"] == "21998761122"
    assert body["email"] == "joao@empresa.com.br"
    assert body["client_id"] is None


def test_contact_requires_name(client):
    auth = auth_for(client)

    resp = client.post("/contacts/", json={"empresa": "Sem nome"}, headers=auth)

    assert resp.status_code == 422


def test_create_contact_accepts_only_name(client):
    auth = auth_for(client)

    resp = client.post("/contacts/", json={"nome": "Só nome"}, headers=auth)

    assert resp.status_code == 201, resp.text
    assert resp.json()["telefone"] is None
    assert resp.json()["empresa"] is None


def test_update_contact_changes_its_own_fields(client):
    auth = auth_for(client)
    created = client.post(
        "/contacts/",
        json={"nome": "Antigo", "telefone": "11988887777", "empresa": "X"},
        headers=auth,
    ).json()

    resp = client.patch(
        f"/contacts/{created['id']}",
        json={"nome": "Novo Nome", "telefone": "11977776666"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["nome"] == "Novo Nome"
    assert body["telefone"] == "11977776666"
    assert body["empresa"] == "X"


def test_delete_contact_hides_it_from_the_listing(client):
    auth = auth_for(client)
    created = client.post(
        "/contacts/", json={"nome": "Temporário"}, headers=auth
    ).json()

    deleted = client.delete(f"/contacts/{created['id']}", headers=auth)
    assert deleted.status_code == 204

    assert list_contacts(client, auth) == []


def test_contact_of_another_user_is_invisible(client):
    owner = auth_for(client, "Dono")
    intruder = auth_for(client, "Intruso")
    created = client.post(
        "/contacts/", json={"nome": "Privado do Dono"}, headers=owner
    ).json()

    assert (
        client.patch(
            f"/contacts/{created['id']}", json={"nome": "Roubado"}, headers=intruder
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/contacts/{created['id']}", headers=intruder).status_code == 404
    )
    assert list_contacts(client, intruder) == []


# ── contatos de prospecto e de cliente ──


def test_listing_joins_free_prospect_and_client_contacts(client):
    auth = auth_for(client)
    make_client_contact(client, auth)
    make_prospect(client, auth, empresa="Lead Aberto Ltda", nome="Nina Prospecto")
    client.post(
        "/contacts/",
        json={"nome": "Zilda Livre", "empresa": "Fornecedor Gamma"},
        headers=auth,
    )

    rows = list_contacts(client, auth)

    # ordenado por nome: Marina Reis, Nina Prospecto, Zilda Livre
    assert [row["origem"] for row in rows] == ["cliente", "prospecto", "livre"]
    cliente = next(row for row in rows if row["origem"] == "cliente")
    assert cliente["nome"] == "Marina Reis"
    assert cliente["email"] == "marina@alfa.com.br"
    assert cliente["telefone"] == "11988771234"
    assert cliente["empresa"] == "Contabilidade Alfa"
    assert cliente["client_id"] is not None
    prospecto = next(row for row in rows if row["origem"] == "prospecto")
    assert prospecto["nome"] == "Nina Prospecto"
    assert prospecto["empresa"] == "Lead Aberto Ltda"
    assert prospecto["client_id"] is None
    assert prospecto["prospect_id"] is not None
    livre = next(row for row in rows if row["origem"] == "livre")
    assert livre["empresa"] == "Fornecedor Gamma"


def test_unconverted_prospect_contact_is_listed(client):
    """Regra: prospecto que ainda não virou cliente continua na agenda."""
    auth = auth_for(client)
    make_prospect(client, auth, empresa="Lead Aberto Ltda", nome="Nina Prospecto")

    rows = list_contacts(client, auth)

    assert len(rows) == 1
    assert rows[0]["origem"] == "prospecto"
    assert rows[0]["nome"] == "Nina Prospecto"
    assert rows[0]["empresa"] == "Lead Aberto Ltda"
    assert rows[0]["tem_pessoa"] is True


def test_archived_prospect_contact_keeps_being_listed(client):
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, empresa="Lead Arquivado", nome="Nina Arquivada"
    )

    deleted = client.delete(f"/prospects/{prospect_id}", headers=auth)
    assert deleted.status_code == 204

    rows = list_contacts(client, auth)
    assert [row["nome"] for row in rows] == ["Nina Arquivada"]
    assert rows[0]["origem"] == "prospecto"


def test_archived_client_contact_keeps_being_listed(client):
    auth = auth_for(client)
    _, client_id = make_client_contact(client, auth)

    deleted = client.delete(f"/clients/{client_id}", headers=auth)
    assert deleted.status_code == 204

    rows = list_contacts(client, auth)
    assert [row["nome"] for row in rows] == ["Marina Reis"]
    assert rows[0]["origem"] == "cliente"


def test_company_without_representative_is_listed_with_its_own_data(client):
    """Regra: empresa sem pessoa cadastrada entra usando telefone/e-mail dela."""
    auth = auth_for(client)
    make_prospect(
        client,
        auth,
        empresa="Lead Sem Pessoa",
        telefone="(21) 3222-1111",
        email="contato@sem-pessoa.com.br",
        representante=None,
    )
    client.post(
        "/clients/",
        json={
            "name": "Cliente Sem Pessoa",
            "phone": "(11) 5555-6666",
            "email": "geral@cliente.com.br",
        },
        headers=auth,
    )

    rows = list_contacts(client, auth)

    prospecto = next(row for row in rows if row["origem"] == "prospecto")
    assert prospecto["nome"] == "Lead Sem Pessoa"
    assert prospecto["empresa"] == "Lead Sem Pessoa"
    assert prospecto["telefone"] == "2132221111"
    assert prospecto["email"] == "contato@sem-pessoa.com.br"
    assert prospecto["tem_pessoa"] is False

    # cliente criado direto (sem prospecto) também entra
    assert [row["nome"] for row in rows if row["origem"] == "cliente"] == [
        "Cliente Sem Pessoa"
    ]


def test_client_without_representative_is_listed(client):
    auth = auth_for(client)
    created = client.post("/clients/", json={"name": "Sem Contato"}, headers=auth)
    assert created.status_code == 201, created.text

    rows = list_contacts(client, auth)

    assert [row["nome"] for row in rows] == ["Sem Contato"]
    assert rows[0]["origem"] == "cliente"
    assert rows[0]["tem_pessoa"] is False
    assert rows[0]["client_id"] == created.json()["id"]


def test_contact_of_another_user_prospect_is_invisible(client):
    owner = auth_for(client, "Dono do Lead")
    intruder = auth_for(client, "Outro Bpo")
    make_client_contact(client, owner)
    make_prospect(client, owner, empresa="Lead Privado", nome="Nina Privada")

    assert list_contacts(client, intruder) == []


# ── edição no cadastro de origem (fonte única) ──


def test_update_prospect_contact_writes_to_the_prospect(client):
    auth = auth_for(client)
    prospect_id = make_prospect(client, auth, empresa="Lead Aberto", nome="Nina Old")

    resp = client.patch(
        f"/contacts/prospects/{prospect_id}",
        json={"nome": "Nina Nova", "telefone": "(21) 99999-0000"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["origem"] == "prospecto"
    assert body["nome"] == "Nina Nova"
    assert body["telefone"] == "21999990000"
    assert body["empresa"] == "Lead Aberto"

    source = read_prospect(prospect_id)
    assert source.representante_nome == "Nina Nova"
    assert source.representante_telefone == "21999990000"


def test_update_client_contact_writes_to_the_source_prospect(client):
    auth = auth_for(client)
    prospect_id, client_id = make_client_contact(client, auth)

    resp = client.patch(
        f"/contacts/prospects/{prospect_id}",
        json={"nome": "Marina R. Costa", "telefone": "11912345678"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["origem"] == "cliente"
    assert body["nome"] == "Marina R. Costa"
    assert body["telefone"] == "11912345678"
    assert body["empresa"] == "Contabilidade Alfa"
    assert body["client_id"] == client_id

    # fonte única de verdade: o cadastro do prospecto de origem foi atualizado
    listing = client.get("/prospects/", headers=auth)
    assert listing.status_code == 200
    assert listing.json() == []  # convertido: fora da listagem de prospects
    source = read_prospect(prospect_id)
    assert source.representante_nome == "Marina R. Costa"
    assert source.representante_telefone == "11912345678"


def test_update_contact_never_renames_the_company(client):
    auth = auth_for(client)
    prospect_id, _ = make_client_contact(client, auth)

    resp = client.patch(
        f"/contacts/prospects/{prospect_id}",
        json={"nome": "Marina Reis", "empresa": "Nome Inventado"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["empresa"] == "Contabilidade Alfa"


def test_update_prospect_contact_of_another_user_returns_404(client):
    owner = auth_for(client, "Dono do Lead")
    intruder = auth_for(client, "Outro Bpo")
    prospect_id, _ = make_client_contact(client, owner)

    # controle positivo: o dono consegue editar (a rota existe e o dono tem acesso)
    assert (
        client.patch(
            f"/contacts/prospects/{prospect_id}",
            json={"nome": "Editada pelo dono"},
            headers=owner,
        ).status_code
        == 200
    )

    resp = client.patch(
        f"/contacts/prospects/{prospect_id}",
        json={"nome": "Invadido"},
        headers=intruder,
    )

    assert resp.status_code == 404


def test_update_company_without_representative_returns_404(client):
    """Sem pessoa cadastrada não há o que editar por aqui."""
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, empresa="Lead Sem Pessoa", representante=None
    )

    assert (
        client.patch(
            f"/contacts/prospects/{prospect_id}",
            json={"nome": "Não existe"},
            headers=auth,
        ).status_code
        == 404
    )


# ── busca ──


def test_search_filters_by_name_company_phone_or_email(client):
    auth = auth_for(client)
    make_client_contact(client, auth, empresa="Contabilidade Alfa", nome="Marina Reis")
    make_prospect(client, auth, empresa="Lead Buscavel", nome="Nina Prospecto")
    client.post(
        "/contacts/",
        json={"nome": "Zilda Livre", "empresa": "Fornecedor Gamma"},
        headers=auth,
    )

    assert [r["nome"] for r in list_contacts(client, auth, q="marina")] == [
        "Marina Reis"
    ]
    assert [r["nome"] for r in list_contacts(client, auth, q="gamma")] == [
        "Zilda Livre"
    ]
    assert [r["nome"] for r in list_contacts(client, auth, q="11988771234")] == [
        "Marina Reis"
    ]
    assert [r["nome"] for r in list_contacts(client, auth, q="marina@alfa")] == [
        "Marina Reis"
    ]
    assert [r["nome"] for r in list_contacts(client, auth, q="nin")] == [
        "Nina Prospecto"
    ]
    assert [r["nome"] for r in list_contacts(client, auth, q="buscavel")] == [
        "Nina Prospecto"
    ]
    assert list_contacts(client, auth, q="não existe") == []


def test_search_ignores_other_users_contacts(client):
    owner = auth_for(client, "Dono")
    intruder = auth_for(client, "Intruso")
    client.post(
        "/contacts/",
        json={"nome": "Busca Privada", "empresa": "Secreto"},
        headers=owner,
    )

    assert list_contacts(client, intruder, q="secreto") == []


def test_listing_can_filter_by_origin(client):
    auth = auth_for(client)
    make_client_contact(client, auth)
    make_prospect(client, auth, empresa="Lead Aberto", nome="Nina Prospecto")
    client.post("/contacts/", json={"nome": "Zilda Livre"}, headers=auth)

    livres = list_contacts(client, auth, origem="livre")
    clientes = list_contacts(client, auth, origem="cliente")
    prospectos = list_contacts(client, auth, origem="prospecto")

    assert [r["nome"] for r in livres] == ["Zilda Livre"]
    assert [r["nome"] for r in clientes] == ["Marina Reis"]
    assert [r["nome"] for r in prospectos] == ["Nina Prospecto"]
