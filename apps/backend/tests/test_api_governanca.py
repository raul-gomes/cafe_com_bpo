from uuid import uuid4

import pytest

from tests.helpers import pricing_input_for_total, register_user


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
            **pricing_input_for_total(final_price),
            "complexity": "Média",
            "revenue": 50000,
        },
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


def test_proposals_list_hides_reproved_linked(client):
    """Negócio não captado sai da listagem de orçamentos, igual ao convertido —
    os dois continuam acessíveis pelo detalhe, que é como a Governança mostra."""
    email = f"gov_hide_repr_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()
    proposal = create_proposal(client, auth, prospect).json()

    assert any(
        p["id"] == proposal["id"]
        for p in client.get("/proposals/", headers=auth).json()
    )

    client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)

    listed = client.get("/proposals/", headers=auth).json()
    assert all(p["id"] != proposal["id"] for p in listed)
    assert client.get(f"/proposals/{proposal['id']}", headers=auth).status_code == 200


def test_contracts_list_hides_reproved_linked(client):
    """Contrato de negócio não captado sai da listagem, como o orçamento.

    Diferente do orçamento, aqui o convertido não é o filtro: quem some por
    conversão é o contrato finalizado, e o reprovado some em qualquer status."""
    email = f"gov_hide_ctr_repr_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth).json()
    contract = generate_contract(client, auth, prospect).json()

    assert any(
        c["id"] == contract["id"]
        for c in client.get("/contracts/", headers=auth).json()
    )

    client.post(f"/prospects/{prospect['id']}/reprove", headers=auth)

    listed = client.get("/contracts/", headers=auth).json()
    assert all(c["id"] != contract["id"] for c in listed)
    assert client.get(f"/contracts/{contract['id']}", headers=auth).status_code == 200


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


def test_deal_contatante_representative_comes_from_the_contact(client):
    """Fase 4: o representante do negócio vem do CONTATO, não da coluna.

    Coluna `representante_*` apagada de propósito (ficou velha) — o DTO deve
    sair com o representante do contato.
    """
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.prospects.models import Prospect

    email = f"gov_f4_rep_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(
        client,
        auth,
        name="Negócio do Contato",
        representante_nome="Pessoa do Contato",
        representante_email="pessoa@governanca.com.br",
    ).json()

    session = SessionLocal()
    try:
        row = (
            session.query(Prospect).filter(Prospect.id == UUID(prospect["id"])).first()
        )
        row.representante_nome = None
        row.representante_email = None
        session.commit()
    finally:
        session.close()

    deal = next(
        d for d in get_deals(client, auth)["deals"] if d["id"] == prospect["id"]
    )
    assert deal["representante_nome"] == "Pessoa do Contato"
    assert deal["representante_email"] == "pessoa@governanca.com.br"


@pytest.mark.xfail(
    strict=True,
    reason=(
        "Fase 3, item 7 (governança) BLOQUEADA: a identidade do negócio convertido é dupla — a "
        "empresa do prospecto é apagada no colapso e sobra a do cliente, mas a tela mantém "
        "id = prospect_id porque é o que liga nas propostas e contratos. Ler de `companies` "
        "trocaria a identidade do negócio. Ver docs/pendencias.md 4.6/4.7 e a opção escolhida pelo "
        "dono. Quando migrar, este teste passa e o `strict=True` obriga a remover o marcador."
    ),
)
def test_deals_are_listed_from_companies_not_the_prospect_row(client):
    """A Governança lê a empresa (Fase 3, item 7).

    A lista de negócios vinha inteira de `prospects`: nome, contatos, segmentação
    e o par `converted_client_id`/`reproved_at` que decide o status do funil. Tudo
    isso já é espelho em `companies`, com o **mesmo id** (a conversão preserva o
    id), então ler de lá não muda chave nenhuma de proposta ou contrato.

    O teste renomeia a empresa por fora da API: o espelho de cadastrais
    reescreveria também a linha `prospects`, e a asserção deixaria de provar
    nada. Com a leitura legada o cartão sai com o nome velho.
    """
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    auth = get_auth_header(client, f"gov_origem_{uuid4()}@cafe.com")
    prospect = create_prospect(client, auth, name="Governança Antiga").json()

    session = SessionLocal()
    try:
        company = session.get(Company, UUID(prospect["id"]))
        company.name = "Governança Nova"
        session.commit()
    finally:
        session.close()

    deals = get_deals(client, auth)["deals"]
    alvo = next(d for d in deals if d["id"] == prospect["id"])
    assert alvo["name"] == "Governança Nova", (
        "a Governança ainda lê o nome da linha `prospects`"
    )


def test_deal_identity_is_split_after_conversion(client):
    """A identidade do negócio convertido é **dupla**, e isso trava a migração.

    Este teste **não** falha no código de hoje: ele fixa a topologia que a
    Governança tem agora, que é o que impede a leitura de virar `companies`
    mecanicamente.

    Depois da conversão existem dois ids, e eles não são o mesmo:
    `companies` tem **uma** linha só, a do cliente (C, `type='client'`,
    `converted_at` preenchido) — a empresa do prospecto (P) é apagada no
    colapso (`companies/sync.py:154`). O negócio na Governança continua com
    `id = P`, que é o que liga nas propostas e nos contratos (`prospect_id`),
    e com `client_id = C`, que é a empresa que sobreviveu.

    Ler a Governança de `companies` significaria trocar a identidade do negócio de
    P para C, e com ela as chaves de proposta e contrato. Isso é decisão de
    produto, não refatoração: está em `docs/pendencias.md` 4.6. O que este teste
    garante é que ninguém troca a identidade sem perceber.
    """
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    auth = get_auth_header(client, f"gov_status_{uuid4()}@cafe.com")
    em_negociacao = create_prospect(client, auth, name="Ainda Negociando").json()
    conquistado = create_prospect(client, auth, name="Virou Cliente").json()
    perdido = create_prospect(client, auth, name="Foi Perdido").json()

    assert client.post(
        f"/prospects/{conquistado['id']}/convert", json={}, headers=auth
    ).status_code in (200, 201)
    assert client.post(
        f"/prospects/{perdido['id']}/reprove", json={}, headers=auth
    ).status_code in (200, 201)

    deals = {d["id"]: d for d in get_deals(client, auth)["deals"]}

    assert deals[em_negociacao["id"]]["status"] == "em_negociacao"
    assert deals[conquistado["id"]]["status"] == "conquistado"
    assert deals[perdido["id"]]["status"] == "perdido"
    assert deals[perdido["id"]]["client_id"] is None

    # A identidade dupla: o negócio fica no id do prospecto (é o que liga nas
    # propostas e contratos) e aponta para o id da empresa que sobreviveu.
    negocio = deals[conquistado["id"]]
    assert negocio["id"] == conquistado["id"]
    assert negocio["client_id"] != conquistado["id"]

    session = SessionLocal()
    try:
        # `companies` guarda a empresa do cliente; a do prospecto não existe mais.
        assert session.get(Company, UUID(conquistado["id"])) is None
        sobrevivente = session.get(Company, UUID(negocio["client_id"]))
        assert sobrevivente is not None and sobrevivente.type == "client"
        assert session.get(Company, UUID(perdido["id"])).reproved_at is not None
    finally:
        session.close()
