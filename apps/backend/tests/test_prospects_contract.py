"""Contrato §6 da vertical de prospects (Fase 3, item 4 do plano unificado).

A listagem passa a ser lida de `companies` (a empresa é a linha única do
negócio) e a resposta vira um DTO escrito à mão: só o que as telas renderizam.
Estes testes fixam o conjunto exato de chaves, para que campo interno não
volte a vazar por acidente e para que a remoção seja visível.
"""

from uuid import UUID, uuid4

from fastapi import status

from tests.helpers import create_test_user

PASSWORD = "StrongPassword123!"

# Cadastrais que o card renderiza + o endereço, que o formulário de edição
# preenche, + o representante, que o card e o formulário leem.
PROSPECT_KEYS = {
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
    "representante_nome",
    "representante_email",
    "representante_cpf",
    "representante_telefone",
    "representante_cargo",
}


def _auth(client, email: str) -> dict:
    """Registra um usuário e devolve o header de autorização dele.

    Args:
        client: The FastAPI test client.
        email: Email to register and log in with.

    Returns:
        The Authorization header of the new user.
    """
    create_test_user(email=email, password=PASSWORD)
    response = client.post(
        "/auth/login", data={"username": email, "password": PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _prospect(client, auth, **overrides) -> dict:
    """Cria um prospecto pela API e devolve o corpo da resposta.

    Args:
        client: The FastAPI test client.
        auth: Authorization header of the owner.
        **overrides: Fields that replace the fixture defaults.

    Returns:
        The decoded body of the created prospect.
    """
    payload = {
        "name": f"Lead {uuid4()}",
        "process_type": "fiscal",
        "cnpj": "11222333000181",
        "representante_nome": "AnaSouza",
    }
    payload.update(overrides)
    response = client.post("/prospects/", json=payload, headers=auth)
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return response.json()


def test_the_prospect_list_ships_only_what_the_cards_render(client):
    """GET /prospects/ returns exactly the fields the prospect card renders."""
    auth = _auth(client, f"pl_{uuid4()}@cafe.com")
    _prospect(client, auth)

    response = client.get("/prospects/", headers=auth)

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()[0]) == PROSPECT_KEYS


def test_the_create_response_ships_the_same_fields_as_the_list(client):
    """POST /prospects/ answers with the same DTO the list renders."""
    auth = _auth(client, f"pc_{uuid4()}@cafe.com")

    created = _prospect(client, auth)

    assert set(created) == PROSPECT_KEYS


def test_the_list_reads_the_company_row(client, db_session):
    """The listing is served by `companies`, not by the legacy prospect table.

    `companies` is the single line of the business: the prospect stage is a
    `type` on it, so the screen has to see the company row. Changing it here is
    what proves the read went through the facade.
    """
    from src.modules.companies.models import Company

    auth = _auth(client, f"pr_{uuid4()}@cafe.com")
    created = _prospect(client, auth)

    company = db_session.get(Company, UUID(created["id"]))
    company.name = "Lead Renomeado Na Empresa"
    db_session.commit()

    listed = client.get("/prospects/", headers=auth).json()

    assert [row["name"] for row in listed] == ["Lead Renomeado Na Empresa"]
    assert listed[0]["cnpj"] == "11222333000181", "cadastral também vem da empresa"


def test_the_representative_comes_from_the_contact(client, db_session):
    """`representante_*` is read from the contact, the Fase 4 source of the person.

    The columns survive on `prospects` until the destructive migration, but they
    are no longer the source: the person lives in `contacts` and is reached
    through `companies.primary_contact_id`.
    """
    from src.modules.contacts.models import Contact

    auth = _auth(client, f"pc2_{uuid4()}@cafe.com")
    created = _prospect(client, auth, representante_nome="Ana Souza")

    contact = (
        db_session.query(Contact)
        .filter(Contact.company_id == UUID(created["id"]), Contact.is_active)
        .one()
    )
    contact.nome = "Ana Souza Atualizada"
    contact.cargo = "Diretora"
    contact.cpf = "52998224725"
    db_session.commit()

    listed = client.get("/prospects/", headers=auth).json()

    assert listed[0]["representante_nome"] == "Ana Souza Atualizada"
    assert listed[0]["representante_cargo"] == "Diretora"
    assert listed[0]["representante_cpf"] == "52998224725"


def test_a_prospect_without_contact_falls_back_to_the_legacy_columns(
    client, db_session
):
    """A company with no active contact still shows the person it had.

    The fallback is the same one `contracts` and `governanca` use: while
    `prospects.representante_*` exists, a company whose contact was archived
    must not lose the person from the screen.
    """
    from src.modules.contacts.models import Contact

    auth = _auth(client, f"pf_{uuid4()}@cafe.com")
    created = _prospect(
        client,
        auth,
        representante_nome="Ana Legacy",
        representante_cargo="Gerente",
    )

    for contact in (
        db_session.query(Contact)
        .filter(Contact.company_id == UUID(created["id"]))
        .all()
    ):
        contact.is_active = False
    db_session.commit()

    listed = client.get("/prospects/", headers=auth).json()

    assert listed[0]["representante_nome"] == "Ana Legacy"
    assert listed[0]["representante_cargo"] == "Gerente"
