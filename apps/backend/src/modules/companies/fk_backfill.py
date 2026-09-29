"""R2 — preencher `company_id` nas tabelas filhas a partir das colunas antigas.

O ponto delicado: **orçamento e contrato podem apontar para um prospecto que já
virou cliente**. Como o par colapsou numa linha só (o `id` do cliente), seguir a
conversão é o que impede a linha de ficar apontando para uma empresa que não
existe mais. Uma linha de negócio que nasce num prospecto continua sendo a mesma
empresa quando ela é conquistada — o vínculo não pode sumir no meio do caminho.

Nas tabelas exclusivas de cliente (`tasks`, `teams`, `client_slas`,
`client_template_assignments`) não há ambiguidade: `client_id` já é a empresa.
"""

from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.modules.clients.models import Client
from src.modules.companies.models import Company
from src.modules.contracts.models import Contract
from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.task_manager.models import (
    ClientSLA,
    ClientTemplateAssignment,
    Task,
)
from src.modules.team.models import Team

# (modelo, aceita prospecto?) — o que decide se a linha precisa seguir a conversão
LEGACY_OWNED = (
    (PricingScenario, True),
    (Contract, True),
    (Task, False),
    (Team, False),
    (ClientSLA, False),
    (ClientTemplateAssignment, False),
)


@dataclass
class FkBackfillReport:
    updated: int = 0
    already_set: int = 0
    without_owner: int = 0
    failures: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "atualizadas": self.updated,
            "ja_preenchidas": self.already_set,
            "sem_empresa": self.without_owner,
            "falhas": self.failures,
        }


def _company_for(
    row, follow_conversion: bool, conversions: dict[UUID, UUID]
) -> UUID | None:
    """A empresa dona da linha, ou `None` se ela não tem dono.

    `client_id` ganha quando existe nos dois lados nunca deveria acontecer, mas
    se acontecer o cliente vence: é o estágio mais avançado do ciclo de vida.
    `contracts` só tem `prospect_id` — é por isso do `getattr`.
    """
    client_id = getattr(row, "client_id", None)
    if client_id is not None:
        return client_id
    prospect_id = getattr(row, "prospect_id", None)
    if prospect_id is None:
        return None
    if follow_conversion:
        return conversions.get(prospect_id, prospect_id)
    return prospect_id


def resolve_company_id(session: Session, row, follow_conversion: bool) -> UUID | None:
    """A empresa dona de uma linha, ou `None` se a linha não tem dono válido.

    Usado tanto pelo backfill quanto pelos listeners de escrita dupla, para que
    as duas metades concordem sobre o que é uma empresa dona. Não confia em
    `company_id` já preenchido: quem chama decide.
    """
    company_ids = set(session.scalars(select(Company.id)))
    client_ids = set(session.scalars(select(Client.id)))
    conversions = {
        prospect_id: converted
        for prospect_id, converted in session.execute(
            select(Prospect.id, Prospect.converted_client_id).where(
                Prospect.converted_client_id.is_not(None)
            )
        )
        if converted in client_ids
    }
    owner = _company_for(row, follow_conversion, conversions)
    if owner is None or owner not in company_ids:
        return None
    return owner


def backfill_company_fks(session: Session) -> FkBackfillReport:
    report = FkBackfillReport()

    # A empresa tem que existir. Sem esta checagem, um `client_id` órfão (ou um
    # prospecto que virou cliente antes de a R1 rodar) produziria um `company_id`
    # apontando para o vazio — e a FK passaria, porque FK só valida no Postgres
    # e este mesmo código roda na migration.
    company_ids = set(session.scalars(select(Company.id)))

    # Só vale converter se o par realmente colapsou: o cliente precisa existir
    # como empresa. Sem essa checagem, um `converted_client_id` pendurado
    # mandaria a linha para um id que não é empresa de ninguém.
    client_ids = set(session.scalars(select(Client.id)))
    conversions = {
        prospect_id: converted
        for prospect_id, converted in session.execute(
            select(Prospect.id, Prospect.converted_client_id).where(
                Prospect.converted_client_id.is_not(None)
            )
        )
        if converted in client_ids
    }

    for model, follow_conversion in LEGACY_OWNED:
        for row in session.scalars(select(model)):
            if row.company_id is not None:
                report.already_set += 1
                continue
            company_id = _company_for(row, follow_conversion, conversions)
            if company_id is None:
                # Orçamento/contrato avulso (sem cliente e sem prospecto) é
                # legítimo: não tem dono e segue assim.
                report.without_owner += 1
                continue
            if company_id not in company_ids:
                report.failures.append(
                    f"{model.__tablename__}:{row.id} -> {company_id} não é empresa"
                )
                continue
            row.company_id = company_id
            if hasattr(model, "company_type"):
                row.company_type = "client"
            report.updated += 1

    session.flush()
    return report
