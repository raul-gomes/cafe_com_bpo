"""Invariantes da verificação de release (V1–V5 do plano unificado).

O plano lista `V5 ≠ 0` como **critério de abortar** do rehearsal:
`pricing_scenarios.company_id IS DISTINCT FROM coalesce(client_id, prospect_id)`
tem de dar zero linhas. Este arquivo existe porque essa consulta não é um
invariante — ela é uma fotografia válida apenas enquanto nenhuma conversão
aconteceu depois do R2.
"""

from uuid import UUID

from sqlalchemy import func, select

from src.core.database import SessionLocal
from src.modules.companies.models import Company
from src.modules.proposals.models import PricingScenario
from tests.test_api_governanca import create_proposal, get_auth_header


def test_converted_proposal_makes_the_v5_check_report_a_row(client):
    """Uma conversão move `company_id` para C e a coluna legada continua em P.

    O colapso (`companies/sync.py:154`) re-aponta `company_id` dos filhos para a
    empresa do cliente, mas `prospect_id`/`client_id` ficam como estavam — o
    comentário do código diz que "as colunas legadas seguem como estão até R4".
    O resultado é que as duas colunas passam a discordar, e a consulta de V5
    passa a encontrar a linha.

    Por que isso importa: o plano trata `V5 ≠ 0` como motivo para **parar** o
    rehearsal. Se a checagem rodar depois de alguém ter convertido um prospecto
    em produção — que é justamente o uso normal do produto — ela aborta o
    rehearsal por um motivo que não é corrupção de dados.
    """
    auth = get_auth_header(client, "v5-convertido@test.com")
    prospect = client.post(
        "/prospects/",
        json={"name": "Convertido V5", "cnpj": "12.345.678/0001-99"},
        headers=auth,
    ).json()
    proposal = create_proposal(client, auth, prospect)
    assert proposal.status_code in (200, 201), proposal.text

    conversion = client.post(f"/prospects/{prospect['id']}/convert", headers=auth)
    assert conversion.status_code == 200, conversion.text
    client_id = conversion.json()["client_id"]

    session = SessionLocal()
    try:
        row = session.execute(
            select(PricingScenario).where(
                PricingScenario.id == UUID(proposal.json()["id"])
            )
        ).scalar_one()

        # O colapso re-apontou a coluna nova para a empresa do cliente...
        assert row.company_id == UUID(client_id)
        # ...e deixou a coluna legada no prospecto, que já não tem empresa.
        assert row.prospect_id == UUID(prospect["id"])
        assert session.get(Company, UUID(prospect["id"])) is None

        # As duas colunas divergem, que é exatamente o que V5 conta. A
        # expressão é a do plano, para o rehearsal e o teste lerem a mesma coisa.
        contagem_v5 = session.execute(
            select(func.count(PricingScenario.id)).where(
                PricingScenario.company_id
                != func.coalesce(PricingScenario.client_id, PricingScenario.prospect_id)
            )
        ).scalar_one()
        assert contagem_v5 == 1
    finally:
        session.close()


def test_v5_uses_coalesce_and_not_a_guessed_precedence(client):
    """O `coalesce(client_id, prospect_id)` do plano é o que a coluna nova
    precisa igualar. Este teste fixa a expressão real da checagem, para o
    rehearsal e o código não divergirem na interpretação."""
    auth = get_auth_header(client, "v5-coalesce@test.com")
    prospect = client.post(
        "/prospects/",
        json={"name": "Coalesce V5", "cnpj": "98.765.432/0001-11"},
        headers=auth,
    ).json()
    create_proposal(client, auth, prospect)

    session = SessionLocal()
    try:
        contagem_v5 = session.execute(
            select(func.count(PricingScenario.id)).where(
                PricingScenario.company_id
                != func.coalesce(PricingScenario.client_id, PricingScenario.prospect_id)
            )
        ).scalar_one()
        # Prospecto ainda aberto: as colunas concordam e V5 não acusa ninguém.
        assert contagem_v5 == 0
    finally:
        session.close()
