"""Contact management: the BPO contact agenda.

The listing is a UNION of three sources, without duplicating data:

1. free contacts (the `contacts` table, registered by the BPO itself);
2. the contact of a PROSPECT — its named person, even before it converts;
3. the contact of a CLIENT — the same person, of the prospect that originated
   the client.

Product-owner rules confirmed on 2026-09-28:

- an unconverted prospect does NOT disappear: its contact shows and is editable;
- an ARCHIVED prospect/client (soft delete) keeps showing;
- a company with NO named person shows with its own phone/email, marked as
  "no person registered" (`tem_pessoa=False`) and not editable here (the person
  is registered in the company record);
- editing a prospect/client row writes to the contact (single source) and the
  company name belongs to the company record, so it is not editable here;
- deletion exists only for a free contact.
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
    company="Contabilidade Alfa",
    person_name="Marina Reis",
    phone="(11) 98877-1234",
    email="marina@alfa.com.br",
):
    """Creates a prospect with a person, converts it to a client, returns the ids."""
    prospect = client.post(
        "/prospects/",
        json={
            "name": company,
            "phone": "(11) 3333-4444",
            "email": "contato@alfa.com.br",
            "representante_nome": person_name,
            "representante_telefone": phone,
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
    company="Lead Aberto Ltda",
    person_name="Lead Ainda Não é Cliente",
    phone="(21) 3222-1111",
    email="lead@aberto.com.br",
    person="Nina Prospecto",
):
    """Open prospect (not converted) and returns its id.

    `person=None` creates the record WITHOUT a named person.
    """
    body = {
        "name": company,
        "phone": phone,
        "email": email,
    }
    if person is not None:
        body["representante_nome"] = person_name
        body["representante_telefone"] = phone
        body["representante_email"] = email
    resp = client.post("/prospects/", json=body, headers=auth)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def read_prospect(prospect_id):
    """Reads the prospect straight from the DB (the listing hides converted ones)."""
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


# ── free contacts ──


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


# ── prospect and client contacts ──


def test_listing_joins_free_prospect_and_client_contacts(client):
    auth = auth_for(client)
    make_client_contact(client, auth)
    make_prospect(
        client, auth, company="Lead Aberto Ltda", person_name="Nina Prospecto"
    )
    client.post(
        "/contacts/",
        json={"nome": "Zilda Livre", "empresa": "Fornecedor Gamma"},
        headers=auth,
    )

    rows = list_contacts(client, auth)

    # sorted by name: Marina Reis, Nina Prospecto, Zilda Livre
    assert [row["origem"] for row in rows] == ["cliente", "prospecto", "livre"]
    company_row = next(row for row in rows if row["origem"] == "cliente")
    assert company_row["nome"] == "Marina Reis"
    assert company_row["email"] == "marina@alfa.com.br"
    assert company_row["telefone"] == "11988771234"
    assert company_row["empresa"] == "Contabilidade Alfa"
    prospect = next(row for row in rows if row["origem"] == "prospecto")
    assert prospect["nome"] == "Nina Prospecto"
    assert prospect["empresa"] == "Lead Aberto Ltda"
    free = next(row for row in rows if row["origem"] == "livre")
    assert free["empresa"] == "Fornecedor Gamma"


def test_unconverted_prospect_contact_is_listed(client):
    """Rule: a prospect that is not a client yet still shows in the agenda."""
    auth = auth_for(client)
    make_prospect(
        client, auth, company="Lead Aberto Ltda", person_name="Nina Prospecto"
    )

    rows = list_contacts(client, auth)

    assert len(rows) == 1
    assert rows[0]["origem"] == "prospecto"
    assert rows[0]["nome"] == "Nina Prospecto"
    assert rows[0]["empresa"] == "Lead Aberto Ltda"
    assert rows[0]["tem_pessoa"] is True


def test_archived_prospect_contact_keeps_being_listed(client):
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, company="Lead Arquivado", person_name="Nina Arquivada"
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
    """Rule: a company with no person shows with its own phone/email."""
    auth = auth_for(client)
    make_prospect(
        client,
        auth,
        company="Lead Sem Pessoa",
        phone="(21) 3222-1111",
        email="contato@sem-pessoa.com.br",
        person=None,
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

    prospect = next(row for row in rows if row["origem"] == "prospecto")
    assert prospect["nome"] == "Lead Sem Pessoa"
    assert prospect["empresa"] == "Lead Sem Pessoa"
    assert prospect["telefone"] == "2132221111"
    assert prospect["email"] == "contato@sem-pessoa.com.br"
    assert prospect["tem_pessoa"] is False

    # a client created directly (no source prospect) shows too
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
    assert rows[0]["id"] == created.json()["id"]


def test_contact_of_another_user_prospect_is_invisible(client):
    owner = auth_for(client, "Dono do Lead")
    intruder = auth_for(client, "Outro Bpo")
    make_client_contact(client, owner)
    make_prospect(client, owner, company="Lead Privado", person_name="Nina Privada")

    assert list_contacts(client, intruder) == []


# ── editing the source record (single source) ──


def test_update_prospect_contact_writes_to_the_prospect(client):
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, company="Lead Aberto", person_name="Nina Old"
    )
    contact_id = primary_contact_of(prospect_id)
    assert contact_id is not None

    resp = client.patch(
        f"/contacts/{contact_id}",
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
    # converted: the company is the client, so the contact lives there
    contact_id = primary_contact_of(client_id)
    assert contact_id is not None

    resp = client.patch(
        f"/contacts/{contact_id}",
        json={"nome": "Marina R. Costa", "telefone": "11912345678"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["origem"] == "cliente"
    assert body["nome"] == "Marina R. Costa"
    assert body["telefone"] == "11912345678"
    assert body["empresa"] == "Contabilidade Alfa"

    # single source of truth: the source prospect record was updated
    listing = client.get("/prospects/", headers=auth)
    assert listing.status_code == 200
    assert listing.json() == []  # convertido: fora da listagem de prospects
    source = read_prospect(prospect_id)
    assert source.representante_nome == "Marina R. Costa"
    assert source.representante_telefone == "11912345678"


def test_update_contact_never_renames_the_company(client):
    auth = auth_for(client)
    _, client_id = make_client_contact(client, auth)
    contact_id = primary_contact_of(client_id)

    resp = client.patch(
        f"/contacts/{contact_id}",
        json={"nome": "Marina Reis", "empresa": "Nome Inventado"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["empresa"] == "Contabilidade Alfa"


def test_update_prospect_contact_of_another_user_returns_404(client):
    owner = auth_for(client, "Dono do Lead")
    intruder = auth_for(client, "Outro Bpo")
    _, client_id = make_client_contact(client, owner)
    contact_id = primary_contact_of(client_id)
    assert contact_id is not None

    # positive control: the owner can edit (the route exists and they own it)
    assert (
        client.patch(
            f"/contacts/{contact_id}",
            json={"nome": "Editada pelo dono"},
            headers=owner,
        ).status_code
        == 200
    )

    resp = client.patch(
        f"/contacts/{contact_id}",
        json={"nome": "Invadido"},
        headers=intruder,
    )

    assert resp.status_code == 404


def test_company_without_person_is_not_editable_in_the_agenda(client):
    """Rule §13: the row without a person carries the COMPANY id — it is not a
    contact.

    Since the row of a company without a representative holds the company id
    (there is no contact), `PATCH /contacts/{id}` answers 404: there is no
    contact to edit there. The person is registered in the company record.
    """
    auth = auth_for(client)
    prospect_id = make_prospect(client, auth, company="Lead Sem Pessoa", person=None)

    row = next(
        r for r in list_contacts(client, auth) if r["empresa"] == "Lead Sem Pessoa"
    )
    assert row["tem_pessoa"] is False
    assert row["id"] == str(prospect_id)

    resp = client.patch(
        f"/contacts/{row['id']}",
        json={"nome": "Não existe"},
        headers=auth,
    )
    assert resp.status_code == 404


# ── search ──


def test_search_filters_by_name_company_phone_or_email(client):
    auth = auth_for(client)
    make_client_contact(
        client, auth, company="Contabilidade Alfa", person_name="Marina Reis"
    )
    make_prospect(client, auth, company="Lead Buscavel", person_name="Nina Prospecto")
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
    make_prospect(client, auth, company="Lead Aberto", person_name="Nina Prospecto")
    client.post("/contacts/", json={"nome": "Zilda Livre"}, headers=auth)

    livres = list_contacts(client, auth, origem="livre")
    clientes = list_contacts(client, auth, origem="cliente")
    prospectos = list_contacts(client, auth, origem="prospecto")

    assert [r["nome"] for r in livres] == ["Zilda Livre"]
    assert [r["nome"] for r in clientes] == ["Marina Reis"]
    assert [r["nome"] for r in prospectos] == ["Nina Prospecto"]


def test_contact_of_a_company_is_not_listed_as_free(client):
    """A company representative is the person **of the company**: the listing
    shows it as prospect/client. If it also showed up as a free contact, the
    same person would appear twice."""
    auth = auth_for(client)
    make_client_contact(client, auth)

    livres = list_contacts(client, auth, origem="livre")
    clientes = list_contacts(client, auth, origem="cliente")

    assert [r["nome"] for r in livres] == []
    assert [r["nome"] for r in clientes] == ["Marina Reis"]


# --- the representative is a contact of the company (Phase 4) ------------------
#
# The representative used to live in `prospects.representante_*` and the agenda
# rebuilt the row on read. Now `contacts` is the source: registering the
# prospect creates the contact, and the agenda reads the contact. The property
# that matters still holds — fixing the phone in the agenda fixes it everywhere
# — and that is what the tests below lock in.


def primary_contact_of(company_id):
    """Primary contact of the company (the representative), read straight from the DB."""
    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    session = SessionLocal()
    try:
        company = session.get(Company, UUID(company_id))
        return None if company is None else company.primary_contact_id
    finally:
        session.close()


def contact_by_id(contact_id):
    from src.core.database import SessionLocal
    from src.modules.contacts.models import Contact

    session = SessionLocal()
    try:
        return session.get(Contact, UUID(str(contact_id)))
    finally:
        session.close()


def test_representative_becomes_the_company_contact(client):
    auth = auth_for(client)
    prospect_id = make_prospect(client, auth, company="Lead Aberto")

    contact_id = primary_contact_of(prospect_id)
    assert contact_id is not None, "cadastrar o representante não criou o contato"
    contact = contact_by_id(contact_id)
    assert contact.nome == "Lead Ainda Não é Cliente"
    assert contact.company_id == UUID(prospect_id)


def test_agenda_shows_the_person_with_the_contact_id(client):
    """The person row is the contact, so editing uses `PATCH /contacts/{id}`."""
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, company="Lead Aberto", person_name="Nina P"
    )
    contact_id = primary_contact_of(prospect_id)

    rows = list_contacts(client, auth)
    row = next(r for r in rows if r["empresa"] == "Lead Aberto")
    assert row["origem"] == "prospecto"
    assert row["tem_pessoa"] is True
    assert row["id"] == str(contact_id)


def test_editing_in_the_agenda_fixes_the_prospect_record(client):
    """The property the single source promises: fix it once and it holds everywhere.

    The phone is checked on the prospect record, the other screen showing the
    same data. If they diverge, the user fixes it and the fix does not land.
    """
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, company="Lead Aberto", person_name="Nina Old"
    )
    contact_id = primary_contact_of(prospect_id)

    resp = client.patch(
        f"/contacts/{contact_id}",
        json={"nome": "Nina Nova", "telefone": "(21) 99999-0000"},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    assert resp.json()["nome"] == "Nina Nova"
    assert resp.json()["telefone"] == "21999990000"
    assert resp.json()["empresa"] == "Lead Aberto"
    source = read_prospect(prospect_id)
    assert source.representante_nome == "Nina Nova"
    assert source.representante_telefone == "21999990000"


def test_updating_the_representative_in_the_record_updates_the_contact(client):
    """The reverse path too: fixing the record fixes the agenda."""
    auth = auth_for(client)
    prospect_id = make_prospect(
        client, auth, company="Lead Aberto", person_name="Nina Antiga"
    )
    contact_id = primary_contact_of(prospect_id)

    resp = client.put(
        f"/prospects/{prospect_id}",
        json={"name": "Lead Aberto", "representante_nome": "Nina Nova"},
        headers=auth,
    )
    assert resp.status_code == 200, resp.text

    assert contact_by_id(contact_id).nome == "Nina Nova"
    row = next(r for r in list_contacts(client, auth) if r["empresa"] == "Lead Aberto")
    assert row["nome"] == "Nina Nova"


def test_company_without_representative_stays_in_the_agenda_without_person(client):
    """Rule §13: a company with no named person shows with its own contact
    data, read-only. The source of the representative became the contact, but
    the row of a company with no contact still exists — otherwise it would
    vanish from the agenda."""
    auth = auth_for(client)
    prospect_id = make_prospect(client, auth, company="Sem Pessoa Ltda", person=None)

    row = next(
        r for r in list_contacts(client, auth) if r["empresa"] == "Sem Pessoa Ltda"
    )
    assert row["tem_pessoa"] is False
    assert row["nome"] == "Sem Pessoa Ltda"
    assert row["telefone"] == "2132221111"
    assert row["email"] == "lead@aberto.com.br"
    assert primary_contact_of(prospect_id) is None


def test_removed_contact_disappears_from_the_agenda(client):
    """A removed company contact (soft delete) disappears; the company stays,
    without a person — the same shape as one that never registered a person."""
    auth = auth_for(client)
    prospect_id = make_prospect(client, auth, company="Lead Aberto", person_name="Nina")
    contact_id = primary_contact_of(prospect_id)

    assert client.delete(f"/contacts/{contact_id}", headers=auth).status_code in (
        200,
        204,
    )

    row = next(r for r in list_contacts(client, auth) if r["empresa"] == "Lead Aberto")
    assert row["tem_pessoa"] is False
    assert row["nome"] == "Lead Aberto"


def test_archived_company_with_contact_stays_in_the_agenda(client):
    """Rule §13: archiving is a CRM operation, not an agenda one."""
    auth = auth_for(client)
    prospect_id = make_prospect(client, auth, company="Lead Aberto", person_name="Nina")
    assert client.delete(f"/prospects/{prospect_id}", headers=auth).status_code in (
        200,
        204,
    )

    row = next(r for r in list_contacts(client, auth) if r["empresa"] == "Lead Aberto")
    assert row["tem_pessoa"] is True
    assert row["nome"] == "Nina"


def test_payload_ships_only_what_the_frontend_reads(client):
    """Rule §6 (AGENTS): a response field only exists if a page/hook reads it.

    No `client_id`/`prospect_id`/`updated_at` — nothing renders them. The
    contract is exactly: how the screen shows the row, and how it tells whether
    it can edit it.
    """
    EXPECTED_KEYS = {
        "id",
        "nome",
        "telefone",
        "email",
        "empresa",
        "origem",
        "tem_pessoa",
    }

    auth = auth_for(client)
    make_client_contact(client, auth)
    make_prospect(client, auth, person="Nina Prospecto")
    make_prospect(client, auth, company="Sem Pessoa S.A.", person=None)
    client.post(
        "/contacts/",
        json={"nome": "Zilda Livre", "empresa": "Fornecedor Gamma"},
        headers=auth,
    )

    rows = list_contacts(client, auth)
    assert {"livre", "prospecto", "cliente"} <= {r["origem"] for r in rows}
    assert any(r["tem_pessoa"] is False for r in rows)

    for row in rows:
        assert set(row.keys()) == EXPECTED_KEYS
