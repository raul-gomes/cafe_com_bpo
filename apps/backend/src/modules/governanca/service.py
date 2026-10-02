"""
Governança Module - Service Layer

Visão macro (mensal) de toda a captação do usuário: cada negócio
(= empresa em prospecção ou já capturada) é classificado como `conquistado`
(convertido em Cliente), `perdido` (reprovado) ou `em_negociacao`, com a
timeline do funil.

A lista vem de `companies`. A identidade do negócio é o id da empresa, e um
negócio convertido **muda de id** no momento da conversão: a empresa do prospecto
é apagada e sobra a do cliente. Isso é consequência de a Governança deixar de ler
`prospects` — decisão do dono em 2026-10-01, e não uma troca de identificador
escolhida: o `company_id` já estava preenchido em orçamentos e contratos, e é
por ele que eles continuam sendo encontrados depois da conversão.
"""

from datetime import datetime
from uuid import UUID

from src.modules.contracts.models import Contract

from .repository import GovernancaRepository
from .schemas import (
    Deal,
    DealAppearance,
    DealContract,
    DealProposal,
    TimelineEvent,
)

_DECISION_LABELS = {
    "approved": "Cliente aprovou a proposta",
    "changes": "Cliente solicitou alterações",
    "rejected": "Cliente reprovou a proposta",
}


def _month_key(value: datetime) -> str:
    """Ano-mês no formato que a tela consome (`2026-03`).

    Deliberadamente **sem** `astimezone`: o agrupamento é por mês do instante
    registrado, e converter para outro fuso aqui arrastaria o negócio de mês
    conforme onde a máquina roda — teste e produção veriam meses diferentes.
    """
    return f"{value.year:04d}-{value.month:02d}"


def _parse_decided_at(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


class GovernancaService:
    def __init__(self, repo: GovernancaRepository):
        self.repo = repo

    def get_deals(self, user_id: UUID) -> list[Deal]:
        """Negócios da Governança, lidos de `companies` e ordenados por nome."""
        companies = self.repo.get_deal_companies(user_id)
        company_ids = [c.id for c in companies]

        proposals_by_company: dict[UUID, list] = {}
        for proposal in self.repo.get_proposals(user_id, company_ids):
            proposals_by_company.setdefault(proposal.company_id, []).append(proposal)

        contracts_by_company: dict[UUID, list] = {}
        for contract in self.repo.get_contracts(user_id, company_ids):
            contracts_by_company.setdefault(contract.company_id, []).append(contract)

        deals: list[Deal] = []
        for company in companies:
            proposals = proposals_by_company.get(company.id, [])
            contracts = contracts_by_company.get(company.id, [])

            status = self._classify(company)
            rep = self.repo.get_representative(company)
            deal = Deal(
                id=company.id,
                name=company.name,
                cnpj=company.cnpj or None,
                segment=company.segment or None,
                color=company.color or None,
                city=company.city or None,
                state=company.state or None,
                email=company.email or None,
                phone=company.phone or None,
                description=company.description or None,
                representante_nome=rep.get("nome"),
                representante_cargo=rep.get("cargo"),
                representante_email=rep.get("email"),
                representante_telefone=rep.get("telefone"),
                representante_cpf=rep.get("cpf"),
                appearances=self._appearances(company, status),
                proposal=self._last_proposal(proposals),
                contract=self._relevant_contract(contracts),
                timeline=self._build_timeline(company, proposals, contracts, status),
            )
            deals.append(deal)

        return deals

    @staticmethod
    def _appearances(company, status: str) -> list[DealAppearance]:
        """Meses em que o negócio aparece, e a tag de cada um.

        Regra do dono (2026-10-01): o negócio aparece no mês em que **começou a
        prospecção** e, se foi capturado, também no mês em que **fechou** — no
        primeiro com a tag `em_negociacao`, no segundo com `conquistado`. É o que
        faz a captação do mês mostrar o que foi negociado e o que foi fechado, em vez
        de só o que existe hoje.

        O que segura a data da prospecção depois da conversão é
        `companies.negotiated_at`: a empresa do cliente nasce na conversão, em
        outro mês, e a empresa do prospecto é apagada.

        Se os dois meses forem o mesmo, sai **um** card com a tag final — duas
        entradas no mesmo mês fariam o negócio contar duas vezes no resumo.
        """
        inicio = company.negotiated_at or company.created_at
        meses: dict[str, str] = {}
        if inicio is not None:
            meses[_month_key(inicio)] = (
                "em_negociacao" if status == "conquistado" else status
            )
        if status == "conquistado" and company.converted_at is not None:
            meses[_month_key(company.converted_at)] = "conquistado"
        return [DealAppearance(month=m, status=s) for m, s in meses.items()]

    @staticmethod
    def _classify(company) -> str:
        """Estágio do funil, pelas flags de ciclo de vida espelhadas na empresa.

        Os mesmos três estágios do legado, com a mesma precedência: converter
        ganha de reprovar, o que faz sentido — negócio capturado não é perdido.
        """
        if company.converted_at is not None:
            return "conquistado"
        if company.reproved_at is not None:
            return "perdido"
        return "em_negociacao"

    @staticmethod
    def _last_proposal(proposals):
        if not proposals:
            return None
        last = proposals[-1]
        final_price = None
        if isinstance(last.result_payload, dict):
            final_price = last.result_payload.get("final_price")
        return DealProposal(
            id=last.id,
            client_name=last.client_name,
            number=last.number,
            final_price=float(final_price) if final_price is not None else None,
            created_at=last.created_at,
        )

    @staticmethod
    def _relevant_contract(contracts):
        if not contracts:
            return None
        # Prioriza o finalizado; senão o mais recente (rascunho).
        chosen = next(
            (c for c in reversed(contracts) if c.status == Contract.STATUS_FINALIZED),
            contracts[-1],
        )
        return DealContract(
            id=chosen.id,
            number=chosen.number,
            status=chosen.status,
            finalized_at=chosen.finalized_at,
            created_at=chosen.created_at,
        )

    @staticmethod
    def _build_timeline(company, proposals, contracts, status) -> list[TimelineEvent]:
        events: list[TimelineEvent] = [
            TimelineEvent(
                type="created",
                label="Prospecção iniciada",
                # `negotiated_at` e não `created_at`: para o negócio já
                # capturado, a empresa que sobreviveu nasceu na conversão, e a
                # timeline precisa continuar mostrando quando a prospecção começou.
                date=company.negotiated_at or company.created_at,
            )
        ]

        if proposals:
            sent = proposals[0]
            events.append(
                TimelineEvent(
                    type="sent",
                    label="Proposta enviada ao cliente para análise",
                    date=sent.shared_at or sent.created_at,
                )
            )

        # Pareceres registrados pelo cliente pelos links públicos, com histórico
        # completo (ex.: Com alterações → posteriormente Aprovado).
        for proposal in proposals:
            history = proposal.decision_history
            if not isinstance(history, list):
                continue
            for entry in history:
                if not isinstance(entry, dict):
                    continue
                kind = entry.get("decision")
                label = _DECISION_LABELS.get(kind)
                if label is None:
                    continue
                events.append(
                    TimelineEvent(
                        type=kind,
                        label=label,
                        date=_parse_decided_at(entry.get("decided_at")),
                    )
                )

        realized_types = {e.type for e in events}
        finalized = next(
            (c for c in contracts if c.status == Contract.STATUS_FINALIZED), None
        )
        if status == "conquistado":
            if "approved" not in realized_types:
                events.append(
                    TimelineEvent(
                        type="approved",
                        label="Proposta aprovada / Contrato assinado",
                        date=finalized.finalized_at
                        if finalized
                        else company.converted_at,
                    )
                )
        elif status == "perdido":
            events.append(
                TimelineEvent(
                    type="rejected",
                    label=(
                        "Proposta recusada pelo cliente"
                        if "rejected" in realized_types
                        else "Proposta recusada"
                    ),
                    date=company.reproved_at,
                )
            )
        elif not realized_types & {"approved", "rejected", "changes"}:
            events.append(
                TimelineEvent(
                    type="pending",
                    label="Aguardando aprovação",
                    mock=True,
                )
            )

        return events
