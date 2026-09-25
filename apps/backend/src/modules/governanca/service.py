"""
Governança Module - Service Layer

Visão macro (mensal) de toda a captação do usuário: cada negócio
(= prospecto) é classificado como `conquistado` (convertido em Cliente),
`perdido` (reprovado) ou `em_negociacao`, com a timeline do funil.
"""

from datetime import datetime
from uuid import UUID

from src.modules.contracts.models import Contract

from .repository import GovernancaRepository
from .schemas import Deal, DealContract, DealProposal, TimelineEvent

_DECISION_LABELS = {
    "approved": "Cliente aprovou a proposta",
    "changes": "Cliente solicitou alterações",
    "rejected": "Cliente reprovou a proposta",
}


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
        prospects = self.repo.get_prospects(user_id)
        prospect_ids = [p.id for p in prospects]

        proposals_by_prospect: dict[UUID, list] = {}
        for proposal in self.repo.get_proposals(user_id, prospect_ids):
            proposals_by_prospect.setdefault(proposal.prospect_id, []).append(proposal)

        contracts_by_prospect: dict[UUID, list] = {}
        for contract in self.repo.get_contracts(user_id, prospect_ids):
            contracts_by_prospect.setdefault(contract.prospect_id, []).append(contract)

        deals: list[Deal] = []
        for prospect in prospects:
            proposals = proposals_by_prospect.get(prospect.id, [])
            contracts = contracts_by_prospect.get(prospect.id, [])

            status = self._classify(prospect)
            deal = Deal(
                id=prospect.id,
                name=prospect.name,
                cnpj=prospect.cnpj or None,
                segment=prospect.segment or None,
                color=prospect.color or None,
                city=prospect.city or None,
                state=prospect.state or None,
                email=prospect.email or None,
                phone=prospect.phone or None,
                description=prospect.description or None,
                representante_nome=prospect.representante_nome or None,
                representante_cargo=prospect.representante_cargo or None,
                representante_email=prospect.representante_email or None,
                representante_telefone=prospect.representante_telefone or None,
                representante_cpf=prospect.representante_cpf or None,
                status=status,
                client_id=prospect.converted_client_id,
                reference_date=self._reference_date(prospect, proposals, contracts),
                proposal=self._last_proposal(proposals),
                contract=self._relevant_contract(contracts),
                timeline=self._build_timeline(prospect, proposals, contracts, status),
            )
            deals.append(deal)

        return deals

    @staticmethod
    def _classify(prospect) -> str:
        if prospect.converted_client_id is not None:
            return "conquistado"
        if prospect.reproved_at is not None:
            return "perdido"
        return "em_negociacao"

    @staticmethod
    def _reference_date(prospect, proposals, contracts):
        dates = [prospect.created_at]
        if proposals:
            dates.extend(p.created_at for p in proposals)
        if contracts:
            dates.extend(c.created_at for c in contracts)
        return min(d for d in dates if d is not None)

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
    def _build_timeline(prospect, proposals, contracts, status) -> list[TimelineEvent]:
        events: list[TimelineEvent] = [
            TimelineEvent(
                type="created",
                label="Prospecção iniciada",
                date=prospect.created_at,
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
                        else prospect.converted_at,
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
                    date=prospect.reproved_at,
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
