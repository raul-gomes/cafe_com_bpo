"""A geração de contrato tem de ler `companies`, não `prospects`.

O negócio é a empresa (decisão do dono, 2026-10-01) e a Governança já sai de
`companies`. Enquanto a geração ainda pedia um `prospect_id` e resolvia a linha
da tabela legada, o R4 (dropar `clients`/`prospects`) derrubaria a tela: o
identificador do negócio já não existia em lugar nenhum consultável.

Estes testes fixam o estado-alvo: o contrato é gerado a partir da **empresa**,
e a empresa sozinha basta — sem nenhuma linha em `prospects`. Por isso eles
criam a `Company` direto, que é exatamente a situação de quem roda o R4.
"""

from datetime import datetime, timezone
from uuid import UUID, uuid4

from src.core.database import SessionLocal
from src.modules.companies.models import COMPANY_TYPE_CLIENT, Company
from tests.test_api_contracts import _auth_header


def create_company_only_business(
    user_id,
    name="Empresa Só na Tabela Nova",
    **overrides,
) -> dict:
    """Negócio que existe **apenas** em `companies` — o estado pós-R4.

    Nenhuma linha em `prospects` e nenhum contato: é o pior caso, e é o que a
    geração de contrato precisa sobreviver.
    """
    session = SessionLocal()
    try:
        company = Company(
            user_id=user_id,
            type=COMPANY_TYPE_CLIENT,
            name=name,
            cnpj="98.765.432/0001-11",
            email="contato@semtabela.com",
            phone="(11) 3123-4567",
            segment="B2B - Tecnologia & Software",
            street="Rua da Empresa",
            number="500",
            neighborhood="Centro",
            city="Campinas",
            state="SP",
            cep="13010000",
            **overrides,
        )
        session.add(company)
        session.commit()
        return {"id": str(company.id), "name": company.name}
    finally:
        session.close()


def _user_id_of(auth_email) -> str:
    """Id do usuário dono do negócio, lido pelo próprio token da sessão."""
    from src.modules.auth.models import User

    session = SessionLocal()
    try:
        return session.query(User).filter(User.email == auth_email).one().id
    finally:
        session.close()


def test_contract_is_generated_from_the_company_row_alone(client):
    """A empresa basta: o contrato sai com os cadastrais dela, sem `prospects`."""
    email = f"contrato_empresa_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    business = create_company_only_business(_user_id_of(email))

    resp = client.post(
        "/contracts/generate", json={"company_id": business["id"]}, headers=auth
    )

    assert resp.status_code == 201, resp.text
    contract = resp.json()
    assert contract["client_name"] == business["name"]
    assert contract["company_id"] == business["id"]

    rendered = "\n".join(section["content"] for section in contract["sections"])
    assert business["name"] in rendered
    assert "98.765.432/0001-11" in rendered
    assert "Rua da Empresa, 500 - Centro, Campinas - SP" in rendered


def test_missing_fields_are_resolved_from_the_company_alone(client):
    """O modal de geração não pode pedir o que a empresa já tem."""
    email = f"contrato_campos_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    business = create_company_only_business(
        _user_id_of(email), name="Empresa Sem Faltantes"
    )

    resp = client.post(
        "/contracts/missing-fields",
        json={"company_id": business["id"]},
        headers=auth,
    )

    assert resp.status_code == 200, resp.text
    asked = {field["key"] for field in resp.json()["fields"]}
    # Cadastrais da empresa resolvem o bloco do contratante sem perguntar.
    assert "contratante_razao_social" not in asked
    assert "contratante_cnpj" not in asked
    assert "contratante_endereco" not in asked


def test_generation_refuses_a_company_of_another_user(client):
    """`company_id` vem do cliente: a checagem de dono é da empresa, não da tela."""
    dono = f"contrato_dono_{uuid4()}@cafe.com"
    intruso = f"contrato_intruso_{uuid4()}@cafe.com"
    _auth_header(client, dono)
    auth_intruso = _auth_header(client, intruso)
    business = create_company_only_business(_user_id_of(dono), name="De Outro Dono")

    resp = client.post(
        "/contracts/generate", json={"company_id": business["id"]}, headers=auth_intruso
    )

    assert resp.status_code in (400, 404), resp.text


def test_generation_refuses_an_archived_company(client):
    """Empresa arquivada não gera contrato: `deleted_at` é a desativação (§16)."""
    email = f"contrato_arquivada_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    business = create_company_only_business(_user_id_of(email), name="Arquivada")
    _archive_company(business["id"])

    resp = client.post(
        "/contracts/generate", json={"company_id": business["id"]}, headers=auth
    )

    assert resp.status_code in (400, 404), resp.text


def _archive_company(company_id: str) -> None:
    """Desativa a empresa como a regra §16 manda: `is_active` + `deleted_at`."""
    session = SessionLocal()
    try:
        company = session.get(Company, UUID(company_id))
        company.is_active = False
        company.deleted_at = datetime.now(timezone.utc)
        session.commit()
    finally:
        session.close()


def test_generation_does_not_return_the_legacy_prospect_link(client):
    """`prospect_id` saiu do payload: nenhuma tela lia, e o R4 apaga a coluna.

    A coluna continua existindo no banco (o `finalize` usa para converter o
    negócio); o que sai daqui é a chave, não a coluna.
    """
    email = f"contrato_payload_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    business = create_company_only_business(_user_id_of(email))

    resp = client.post(
        "/contracts/generate", json={"company_id": business["id"]}, headers=auth
    )

    assert resp.status_code == 201, resp.text
    assert "prospect_id" not in resp.json()


def test_legacy_prospect_link_is_written_only_for_a_business_in_prospection(client):
    """A coluna legada que o `finalize` usa só faz sentido em prospecção.

    O negócio em prospecção **é** a linha do prospecto (mesmo id), então o
    vínculo sai sem ler `prospects`. Um negócio já convertido não tem prospecto:
    preencher a coluna faria o `finalize` tentar converter de novo.
    """
    from src.modules.contracts.models import Contract

    email = f"contrato_coluna_{uuid4()}@cafe.com"
    auth = _auth_header(client, email)
    user_id = _user_id_of(email)
    prospect = client.post(
        "/prospects/", json={"name": "Ainda em Prospecção"}, headers=auth
    ).json()

    em_prospeccao = client.post(
        "/contracts/generate", json={"company_id": prospect["id"]}, headers=auth
    )
    assert em_prospeccao.status_code == 201, em_prospeccao.text

    convertido = create_company_only_business(user_id, name="Já Convertido")
    ja_convertido = client.post(
        "/contracts/generate", json={"company_id": convertido["id"]}, headers=auth
    )
    assert ja_convertido.status_code == 201, ja_convertido.text

    session = SessionLocal()
    try:
        linhas = {
            row.id: row
            for row in session.query(Contract).filter(Contract.user_id == user_id).all()
        }
        assert linhas[UUID(em_prospeccao.json()["id"])].prospect_id == UUID(
            prospect["id"]
        )
        assert linhas[UUID(ja_convertido.json()["id"])].prospect_id is None
    finally:
        session.close()
