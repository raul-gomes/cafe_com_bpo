"""Fase 3, item 1 (fatia do R4): o orçamento é vinculado pela **empresa**.

O vínculo deixou de ser `prospect_id` — nome que não sobrevive à unificação,
porque o dono do negócio pode ser um prospecto ou um cliente — e passou a ser
`company_id`, a coluna que o R2 já gravava e que a Governança já agrupava.

Regressões cobertas aqui:

1. `POST /proposals/` com `company_id` da empresa do usuário grava o vínculo
   (e mantém a coluna legada em escrita dupla, senão o V5 do rehearsal passa a
   acusar divergência em toda linha nova);
2. `company_id` de outro usuário é recusado **sem gravar** nada — o id vem do
   corpo, então sem a checagem de posse o endpoint virava verificação de
   existência de negócio alheio;
3. `PUT` troca o vínculo;
4. o contrato não carrega mais `prospect_id` (§6);
5. arquivar o prospecto segue escondendo os orçamentos da empresa (o corte de
   `delete_by_prospect`, que lia a coluna legada).
"""

from uuid import UUID

from tests.helpers import paid_auth_header as auth_header
from tests.helpers import pricing_input_for_total, unique_email


def _create_company(client, auth, kind: str, name: str = "Empresa do Teste") -> dict:
    """Cria uma empresa do usuário autenticado e devolve o corpo da resposta."""
    path = "/clients/" if kind == "client" else "/prospects/"
    resp = client.post(path, json={"name": name}, headers=auth)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()


def _saved_row(proposal_id: str):
    """Lê a linha gravada direto na tabela (o contrato não expõe as legadas)."""
    from src.core.database import SessionLocal
    from src.modules.proposals.models import PricingScenario

    session = SessionLocal()
    try:
        return session.get(PricingScenario, UUID(proposal_id))
    finally:
        session.close()


def test_create_proposal_links_the_company_of_the_user(client):
    auth = auth_header(client, unique_email("prop_company"))
    company = _create_company(client, auth, "client")

    resp = client.post(
        "/proposals/",
        json={
            "client_name": "Cliente do Teste",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": company["id"],
        },
        headers=auth,
    )

    assert resp.status_code == 201, resp.text
    assert resp.json()["company_id"] == company["id"]


def test_create_proposal_keeps_the_legacy_column_for_a_client_company(client):
    """Escrita dupla (R2): a coluna legada continua preenchida pelo id da empresa,
    então o V5 (`company_id IS DISTINCT FROM coalesce(client_id, prospect_id)`)
    não acusa divergência na linha nova."""
    auth = auth_header(client, unique_email("prop_dual_client"))
    company = _create_company(client, auth, "client")

    resp = client.post(
        "/proposals/",
        json={
            "client_name": "Cliente do Teste",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": company["id"],
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text

    scenario = _saved_row(resp.json()["id"])
    assert str(scenario.company_id) == company["id"]
    assert str(scenario.client_id) == company["id"]
    assert scenario.prospect_id is None


def test_create_proposal_keeps_the_legacy_column_for_a_prospect_company(client):
    auth = auth_header(client, unique_email("prop_dual_prospect"))
    company = _create_company(client, auth, "prospect")

    resp = client.post(
        "/proposals/",
        json={
            "client_name": "Prospecto do Teste",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": company["id"],
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text

    scenario = _saved_row(resp.json()["id"])
    assert str(scenario.prospect_id) == company["id"]
    assert scenario.client_id is None


def test_create_proposal_refuses_a_company_of_another_user(client):
    """`company_id` chega do corpo: empresa alheia tem de dar o mesmo erro de
    inexistente, e nada pode ser gravado."""
    owner_auth = auth_header(client, unique_email("prop_owner"))
    other_auth = auth_header(client, unique_email("prop_other"))
    company = _create_company(client, owner_auth, "client", "Empresa do Outro")

    resp = client.post(
        "/proposals/",
        json={
            "client_name": "Vizinho Curioso",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": company["id"],
        },
        headers=other_auth,
    )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Empresa não encontrada"
    assert client.get("/proposals/", headers=other_auth).json() == []


def test_create_proposal_without_company_still_works_with_a_free_name(client):
    auth = auth_header(client, unique_email("prop_free"))
    resp = client.post(
        "/proposals/",
        json={
            "client_name": "Nome Livre",
            "input_payload": pricing_input_for_total(100.0),
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["company_id"] is None


def test_proposal_payload_drops_the_legacy_prospect_id(client):
    """§6: `prospect_id` sai do payload — o vínculo é pela empresa."""
    auth = auth_header(client, unique_email("prop_contract"))
    company = _create_company(client, auth, "prospect")

    resp = client.post(
        "/proposals/",
        json={
            "client_name": "Prospecto do Teste",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": company["id"],
        },
        headers=auth,
    )
    assert resp.status_code == 201, resp.text

    listed = client.get("/proposals/", headers=auth)
    assert listed.status_code == 200
    assert "prospect_id" not in listed.json()[0]

    detail = client.get(f"/proposals/{resp.json()['id']}", headers=auth)
    assert detail.status_code == 200
    assert "prospect_id" not in detail.json()


def test_update_proposal_moves_the_link_to_another_company(client):
    auth = auth_header(client, unique_email("prop_move"))
    first = _create_company(client, auth, "client", "Empresa A")
    second = _create_company(client, auth, "client", "Empresa B")

    created = client.post(
        "/proposals/",
        json={
            "client_name": "Cliente do Teste",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": first["id"],
        },
        headers=auth,
    )
    proposal_id = created.json()["id"]

    updated = client.put(
        f"/proposals/{proposal_id}",
        json={
            "client_name": "Cliente do Teste",
            "input_payload": pricing_input_for_total(200.0),
            "company_id": second["id"],
        },
        headers=auth,
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["company_id"] == second["id"]
    assert str(_saved_row(proposal_id).client_id) == second["id"]


def test_update_proposal_refuses_a_company_of_another_user(client):
    owner_auth = auth_header(client, unique_email("prop_upd_owner"))
    other_auth = auth_header(client, unique_email("prop_upd_other"))
    theirs = _create_company(client, owner_auth, "client", "Empresa Alheia")

    created = client.post(
        "/proposals/",
        json={
            "client_name": "Cliente do Teste",
            "input_payload": pricing_input_for_total(100.0),
        },
        headers=other_auth,
    )
    proposal_id = created.json()["id"]

    resp = client.put(
        f"/proposals/{proposal_id}",
        json={
            "client_name": "Cliente do Teste",
            "input_payload": pricing_input_for_total(200.0),
            "company_id": theirs["id"],
        },
        headers=other_auth,
    )

    assert resp.status_code == 404
    detail = client.get(f"/proposals/{proposal_id}", headers=other_auth)
    assert detail.json()["company_id"] is None


def test_archiving_the_prospect_hides_the_proposals_of_the_company(client):
    """O corte de `delete_by_prospect`: quem esconde é a empresa, então o
    orçamento vinculado pela empresa também sai da listagem."""
    auth = auth_header(client, unique_email("prop_archive"))
    company = _create_company(client, auth, "prospect", "Prospecto Arquivado")

    created = client.post(
        "/proposals/",
        json={
            "client_name": "Prospecto Arquivado",
            "input_payload": pricing_input_for_total(100.0),
            "company_id": company["id"],
        },
        headers=auth,
    )
    assert created.status_code == 201, created.text
    assert len(client.get("/proposals/", headers=auth).json()) == 1

    deleted = client.delete(f"/prospects/{company['id']}", headers=auth)
    assert deleted.status_code in (200, 204), deleted.text

    assert client.get("/proposals/", headers=auth).json() == []
