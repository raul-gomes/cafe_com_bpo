"""`companies.negotiated_at` — a data em que a prospecção começou.

Motivo (regra do dono, 2026-10-01): a Governança agrupa o negócio pelo mês em
que ele **começou a ser prospectado**, e um negócio convertido aparece também no
mês em que fechou. Depois do colapso, a linha que sobrevive em `companies` é a
do cliente, criada no instante da conversão — a data original da prospecção não
existia mais em lugar nenhum da tabela nova. `negotiated_at` é o lugar dela.

Sem esta coluna, migrar a Governança para `companies` deslocaria para o mês da
conversão todo negócio que foi prospectado antes, mudando o agrupamento mensal
que a tela mostra.
"""

from uuid import UUID

from src.core.database import SessionLocal
from src.modules.companies.models import COMPANY_TYPE_CLIENT, Company
from tests.test_api_governanca import get_auth_header


def _create_prospect(client, auth, name="Negociada"):
    """Cria o prospecto e devolve (id do prospecto, `created_at` da empresa)."""
    resp = client.post(
        "/prospects/", json={"name": name, "cnpj": "11.222.333/0001-44"}, headers=auth
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def test_new_prospect_company_carries_the_negotiation_date(client):
    """O espelho nasce com `negotiated_at` = `created_at` da empresa."""
    auth = get_auth_header(client, "negotiated_at_criacao@test.com")
    prospect_id = _create_prospect(client, auth)

    session = SessionLocal()
    try:
        company = session.get(Company, UUID(prospect_id))
        assert company is not None
        assert company.negotiated_at is not None
        # O instante da prospecção é o da criação da linha. Não dá para exigir
        # igualdade exata com `created_at`: o `created_at` é `server_default` e
        # o banco o avalia depois do insert, enquanto `negotiated_at` é
        # carimbado no insert em Python. O que a Governança precisa é que os
        # dois caiam no mesmo mês.
        assert abs((company.negotiated_at - company.created_at).total_seconds()) < 60
    finally:
        session.close()


def test_conversion_carries_the_original_date_to_the_client_company(client):
    """A empresa que sobrevive à conversão guarda a data da prospecção, não a
    data da conversão. Este é o teste que impede a Governança de pular de mês."""
    auth = get_auth_header(client, "negotiated_at_conversao@test.com")
    prospect_id = _create_prospect(client, auth, name="Negociada e Convertida")

    session = SessionLocal()
    try:
        before = session.get(Company, UUID(prospect_id))
        negotiated_at = before.negotiated_at
    finally:
        session.close()

    conversion = client.post(f"/prospects/{prospect_id}/convert", headers=auth)
    assert conversion.status_code == 200, conversion.text
    client_id = conversion.json()["client_id"]

    session = SessionLocal()
    try:
        company = session.get(Company, UUID(client_id))
        assert company is not None
        assert company.type == COMPANY_TYPE_CLIENT
        # A data da prospecção sobreviveu à conversão...
        assert company.negotiated_at == negotiated_at
        # ...e a empresa do prospecto não existe mais.
        assert session.get(Company, UUID(prospect_id)) is None
    finally:
        session.close()
