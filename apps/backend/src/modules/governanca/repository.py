"""Governança Module - Repository Layer

Consulta as entidades de outros módulos (companies, pricing_scenarios,
contracts) diretamente, como camada de agregação (sem modelos próprios).
"""

from uuid import UUID

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from src.modules.companies.models import (
    COMPANY_TYPE_CLIENT,
    COMPANY_TYPE_PROSPECT,
    Company,
)
from src.modules.companies.representative import resolve_representative
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario


class GovernancaRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_representative(self, company: Company) -> dict[str, str | None]:
        """Representante do negócio — `Contact` ativo, colunas legadas depois.

        Delega para `companies.representative`, que é a fonte única: o contrato
        renderiza os mesmos tokens e não pode divergir do que a tela mostra.
        """
        return resolve_representative(self.session, company)

    def get_deal_companies(self, user_id: UUID) -> list[Company]:
        """Empresas que são negócios na Governança: em prospecção, perdidas ou
        já capturadas.

        Reproduz 1:1 o filtro de `ProspectRepository.get_by_user` legado, que
        trazia `is_active OR converted_client_id IS NOT NULL` — ou seja,
        prospecto vivo (negociação ou perdido) mais o que já virou cliente, e
        deixava de fora o prospecto arquivado sem conversão. Em `companies` o
        par não existe mais (a conversão apaga a empresa do prospecto e deixa a
        do cliente), então o mesmo conjunto é:

        - `type='prospect'` vivo: negociação e perdido (`reproved_at` decide a
          tag, e a reprovação **não** desativa a empresa — é marcação, não
          soft delete, regra §9 de `docs/regras_negocio.md`);
        - `type='client'` com `converted_at`: o negócio capturado. Sem exigir
          `is_active`, porque o legado também trazia o convertido desativado — a
          Governança é o histórico, não a lista de ativos.

        Cliente criado direto (sem `converted_at`) nunca foi negócio e não
        entra, que é o que o legado fazia por não existir linha de prospecto.
        """
        return (
            self.session.query(Company)
            .filter(
                Company.user_id == user_id,
                or_(
                    and_(
                        Company.type == COMPANY_TYPE_PROSPECT,
                        Company.is_active,
                        Company.deleted_at.is_(None),
                    ),
                    and_(
                        Company.type == COMPANY_TYPE_CLIENT,
                        Company.converted_at.isnot(None),
                    ),
                ),
            )
            .order_by(Company.name)
            .all()
        )

    def get_proposals(
        self, user_id: UUID, company_ids: list[UUID]
    ) -> list[PricingScenario]:
        """Orçamentos dos negócios, pelo `company_id` (e não `prospect_id`).

        A coluna `company_id` é a que o colapso re-aponta para a empresa que
        sobreviveu, então é por ela que um orçamento continua sendo encontrado
        depois da conversão — era o que mantinha esta leitura presa a
        `prospects` mesmo com a coluna nova preenchida.
        """
        if not company_ids:
            return []
        return (
            self.session.query(PricingScenario)
            .filter(
                PricingScenario.user_id == user_id,
                PricingScenario.is_active,
                PricingScenario.company_id.in_(company_ids),
            )
            .order_by(PricingScenario.created_at.asc())
            .all()
        )

    def get_contracts(self, user_id: UUID, company_ids: list[UUID]) -> list[Contract]:
        """Contratos dos negócios, pelo `company_id`. Mesmo motivo de
        `get_proposals`."""
        if not company_ids:
            return []
        return (
            self.session.query(Contract)
            .filter(
                Contract.user_id == user_id,
                Contract.is_active,
                Contract.company_id.in_(company_ids),
            )
            .order_by(Contract.created_at.asc())
            .all()
        )
