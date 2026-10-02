from uuid import uuid4

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
    # O negócio é a empresa e, enquanto em prospecção, empresa e prospecto
    # compartilham o id — a geração recebe a empresa.
    body = {"company_id": prospect["id"]}
    if proposal is not None:
        body["proposal_id"] = proposal["id"]
    return client.post("/contracts/generate", json=body, headers=auth)


def get_deals(client, auth):
    resp = client.get("/governanca/deals", headers=auth)
    assert resp.status_code == 200
    return resp.json()


def deal_status(deal) -> str:
    """Estágio atual do negócio: a tag do **último** mês em que ele aparece.

    A tag passou a ser por mês (regra do dono, 2026-10-01) — um negócio
    capturado é `em_negociacao` no mês da prospecção e `conquistado` no do
    fechamento. Os testes que verificam o estágio do negócio usam o último mês.
    """
    return deal["appearances"][-1]["status"]


def test_deals_grouped_by_status(client):
    email = f"gov_status_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)

    conquistado = create_prospect(client, auth, name="Ganhou Negócio").json()
    # A conversão devolve o id da empresa que sobreviveu, e é esse id que o
    # negócio passa a ter na Governança.
    conversao = client.post(f"/prospects/{conquistado['id']}/convert", headers=auth)
    assert conversao.status_code in (200, 201)
    conquistado_id = conversao.json()["client_id"]

    perdido = create_prospect(client, auth, name="Perdeu Negócio").json()
    client.post(f"/prospects/{perdido['id']}/reprove", headers=auth)

    create_prospect(client, auth, name="Em Negociação")

    data = get_deals(client, auth)
    assert data["months"]
    by_id = {d["id"]: d for d in data["deals"]}

    assert deal_status(by_id[conquistado_id]) == "conquistado"
    assert deal_status(by_id[perdido["id"]]) == "perdido"

    negociacao = next(d for d in data["deals"] if d["name"] == "Em Negociação")
    assert deal_status(negociacao) == "em_negociacao"


def test_conquistado_deal_timeline_and_links(client):
    email = f"gov_win_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(client, auth, name="Cliente Fechado").json()
    proposal = create_proposal(client, auth, prospect, final_price=3300.0).json()
    contract = generate_contract(client, auth, prospect, proposal).json()
    # Finalizar o contrato converte o prospecto em cliente, e a resposta traz o
    # id da empresa que sobrevveu — o id do negócio na Governança.
    finalizacao = client.post(f"/contracts/{contract['id']}/finalize", headers=auth)
    assert finalizacao.status_code in (200, 201), finalizacao.text
    negocio_id = finalizacao.json()["client_id"]

    data = get_deals(client, auth)
    deal = next(d for d in data["deals"] if d["id"] == negocio_id)

    assert deal_status(deal) == "conquistado"
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

    assert deal_status(deal) == "perdido"
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

    assert deal_status(deal) == "em_negociacao"
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

    assert deal_status(deal) == "em_negociacao"
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


def test_deal_in_prospection_without_contact_still_shows_its_representative(client):
    """Negócio em prospecção com representante **só** na coluna legada.

    Cadastrar um representante hoje nasce um `Contact` junto, então o fallback
    existe para o dado anterior a isso: a linha de `prospects` com o representante
    escrito e nenhum contato. A busca antiga só olhava
    `converted_client_id` (o vínculo que só existe **depois** da conversão), então
    em prospecção o negócio aparecia sem representante — a coluna estava lá e
    ninguém lia.
    """
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.companies.models import Company
    from src.modules.contacts.models import Contact
    from src.modules.prospects.models import Prospect

    email = f"gov_rep_prospeccao_{uuid4()}@cafe.com"
    auth = get_auth_header(client, email)
    prospect = create_prospect(
        client,
        auth,
        name="Prospecção sem Contato",
        representante_nome="Só na Coluna",
    ).json()

    # Estado pré-backfill: some o contato, a coluna legada fica.
    session = SessionLocal()
    try:
        row = session.query(Prospect).filter(Prospect.id == UUID(prospect["id"])).one()
        contact = (
            session.query(Contact)
            .filter(Contact.company_id == UUID(prospect["id"]))
            .first()
        )
        assert contact is not None, "o cadastro de hoje deveria ter criado o contato"
        session.delete(contact)
        row.representante_nome = "Só na Coluna"
        session.flush()
        company = session.get(Company, UUID(prospect["id"]))
        company.primary_contact_id = None
        session.commit()
    finally:
        session.close()

    deal = next(
        d for d in get_deals(client, auth)["deals"] if d["id"] == prospect["id"]
    )
    assert deal["representante_nome"] == "Só na Coluna"


def test_deals_are_listed_from_companies_not_the_prospect_row(client):
    """A Governança lê a empresa (Fase 3, item 7).

    A lista de negócios vinha inteira de `prospects`: nome, contatos, segmentação
    e as flags de ciclo de vida que decidem o status do funil. Tudo isso já é
    espelho em `companies`, então ler de lá não muda o que a tela mostra — só a
    origem. Para negócio convertido muda o id, e isso está em
    `test_deal_identity_becomes_the_surviving_company_after_conversion`.

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


def test_deal_identity_becomes_the_surviving_company_after_conversion(client):
    """A identidade do negócio convertido é a **empresa que sobreviveu**.

    Este teste documenta a topologia depois da migração da Governança para
    `companies` (decisão do dono, 2026-10-01, `docs/pendencias.md` 4.6).

    Na conversão existem dois ids, e não são o mesmo: a empresa do prospecto (P) é
    apagada no colapso (`companies/sync.py:154`) e sobra a do cliente (C,
    `type='client'`, `converted_at` preenchido). A Governança agora lista
    `companies`, então o negócio sai com `id = C` — era `P` quando a lista vinha
    de `prospects`.

    Orçamentos e contratos **não**accompanham essa troca e não precisam: eles já
    carregavam `company_id = C` desde o colapso, e é por essa coluna que a
    Governança os agrupa. O que a migração trocou foi a identidade do negócio, não
    a chave dos documentos.
    """
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    auth = get_auth_header(client, f"gov_identidade_{uuid4()}@cafe.com")
    em_negociacao = create_prospect(client, auth, name="Ainda Negociando").json()
    conquistado = create_prospect(client, auth, name="Virou Cliente").json()
    perdido = create_prospect(client, auth, name="Foi Perdido").json()

    conversao = client.post(
        f"/prospects/{conquistado['id']}/convert", json={}, headers=auth
    )
    assert conversao.status_code in (200, 201)
    client_id = conversao.json()["client_id"]
    assert client.post(
        f"/prospects/{perdido['id']}/reprove", json={}, headers=auth
    ).status_code in (200, 201)

    deals = {d["name"]: d for d in get_deals(client, auth)["deals"]}

    # Quem não converteu mantém o próprio id: empresa do prospecto e negócio são
    # a mesma linha.
    assert deals["Ainda Negociando"]["id"] == em_negociacao["id"]
    assert deals["Foi Perdido"]["id"] == perdido["id"]

    # Quem converteu passa a ser a empresa que sobrou, e o id antigo não existe
    # mais como empresa.
    assert deals["Virou Cliente"]["id"] == client_id
    assert deals["Virou Cliente"]["id"] != conquistado["id"]

    session = SessionLocal()
    try:
        assert session.get(Company, UUID(conquistado["id"])) is None
        sobrevivente = session.get(Company, UUID(client_id))
        assert sobrevivente is not None and sobrevivente.type == "client"
        assert session.get(Company, UUID(perdido["id"])).reproved_at is not None
    finally:
        session.close()


def _set_deal_dates(client, company_id, *, negotiated_at, converted_at=None):
    """Fixa as datas do negócio direto na empresa, para o agrupamento mensal ser
    determinístico. Uma conversão e uma prospecção acontecem no mesmo instante
    num teste, então os dois meses cairiam juntos e a regra dos dois meses não
    seria observável."""
    from datetime import datetime, timezone
    from uuid import UUID

    from src.core.database import SessionLocal
    from src.modules.companies.models import Company

    def _aware(value):
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)

    session = SessionLocal()
    try:
        company = session.get(Company, UUID(company_id))
        company.negotiated_at = _aware(negotiated_at)
        if converted_at is not None:
            company.converted_at = _aware(converted_at)
        session.commit()
    finally:
        session.close()


def test_converted_deal_appears_in_the_prospecting_month_and_in_the_closing_month(
    client,
):
    """Regra do dono (2026-10-01): o negócio aparece no mês em que começou a
    prospecção, como **em negociação**, e no mês em que fechou, como
    **conquistado**. A mesma empresa, em dois cards, com a tag de cada época.

    Sem isso, a Governança migrada para `companies` mostraria todo negócio
    capturado apenas no mês da conversão — a data da prospecção morre com a
    empresa do prospecto, e é por isso que existe `companies.negotiated_at`.
    """
    auth = get_auth_header(client, f"gov_meses_{uuid4()}@cafe.com")
    prospect = create_prospect(client, auth, name="Fechou em Outro Mês").json()
    conversao = client.post(
        f"/prospects/{prospect['id']}/convert", json={}, headers=auth
    )
    assert conversao.status_code in (200, 201), conversao.text
    client_id = conversao.json()["client_id"]

    _set_deal_dates(
        client,
        client_id,
        negotiated_at="2026-03-10T09:00:00",
        converted_at="2026-05-22T16:30:00",
    )

    deal = next(
        d
        for d in get_deals(client, auth)["deals"]
        if d["name"] == "Fechou em Outro Mês"
    )
    aparicoes = {a["month"]: a["status"] for a in deal["appearances"]}
    assert aparicoes == {"2026-03": "em_negociacao", "2026-05": "conquistado"}, (
        f"negócio convertido deveria aparecer nos dois meses, veio {aparicoes}"
    )


def test_negotiation_and_closing_in_the_same_month_yields_one_card(client):
    """Prospecção e conversão no mesmo mês: **um** card só, com a tag final.

    Dois cards de meses diferentes é a regra; duas entradas no mesmo mês
    fariam o negócio contar duas vezes no resumo daquele mês.
    """
    auth = get_auth_header(client, f"gov_mes_unico_{uuid4()}@cafe.com")
    prospect = create_prospect(client, auth, name="Fechou no Mesmo Mês").json()
    conversao = client.post(
        f"/prospects/{prospect['id']}/convert", json={}, headers=auth
    )
    assert conversao.status_code in (200, 201), conversao.text

    _set_deal_dates(
        client,
        conversao.json()["client_id"],
        negotiated_at="2026-04-02T09:00:00",
        converted_at="2026-04-28T17:00:00",
    )

    deal = next(
        d
        for d in get_deals(client, auth)["deals"]
        if d["name"] == "Fechou no Mesmo Mês"
    )
    assert deal["appearances"] == [{"month": "2026-04", "status": "conquistado"}]


def test_open_and_lost_deals_appear_once_in_the_prospecting_month(client):
    """Negócio que não fechou não ganha segunda aparição: a regra dos dois meses
    é sobre a conversão, e inventar uma segunda entrada para o mês da perda
    mudaria o resumo de meses onde antes havia um card só."""
    auth = get_auth_header(client, f"gov_mes_abertos_{uuid4()}@cafe.com")
    em_negociacao = create_prospect(client, auth, name="Segue Negociação").json()
    perdido = create_prospect(client, auth, name="Segue Perdido").json()
    assert client.post(
        f"/prospects/{perdido['id']}/reprove", json={}, headers=auth
    ).status_code in (200, 201)

    _set_deal_dates(client, em_negociacao["id"], negotiated_at="2026-06-01T09:00:00")
    _set_deal_dates(client, perdido["id"], negotiated_at="2026-07-01T09:00:00")

    deals = {d["name"]: d for d in get_deals(client, auth)["deals"]}
    assert deals["Segue Negociação"]["appearances"] == [
        {"month": "2026-06", "status": "em_negociacao"}
    ]
    assert deals["Segue Perdido"]["appearances"] == [
        {"month": "2026-07", "status": "perdido"}
    ]


def test_deal_payload_carries_only_what_the_governance_screen_reads(client):
    """Regra §6: o payload tem o que a tela lê e nada mais.

    `client_id` nunca foi lido por ninguém, `reference_date` virou `appearances`
    (a data deixou de ser um valor só) e `status` passou a ser de cada mês, não
    do negócio — o frontend deriva a tag do mês que está olhando.
    """
    auth = get_auth_header(client, f"gov_payload_{uuid4()}@cafe.com")
    prospect = create_prospect(client, auth, name="Payload Mínimo").json()

    deal = next(
        d for d in get_deals(client, auth)["deals"] if d["id"] == prospect["id"]
    )
    for campo in ("client_id", "reference_date", "status"):
        assert campo not in deal, f"`{campo}` não é mais lido pela Governança"
