from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.modules.prospects.models import Prospect

from .default_template import (
    DEFAULT_TEMPLATE_SECTIONS,
    LEGACY_DEFAULT_TEMPLATE_SECTIONS,
)
from .models import Contract, ContractTemplate
from .schemas import ContractSection


class ContractRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Template do usuário ─────────────────────────────────────

    def get_template(self, user_id: UUID) -> ContractTemplate | None:
        return (
            self.session.query(ContractTemplate)
            .filter(ContractTemplate.user_id == user_id)
            .first()
        )

    def get_or_create_template(self, user_id: UUID) -> ContractTemplate:
        template = self.get_template(user_id)
        if template is not None:
            # Modelo vazio ou legado (pré-contrato.pdf) → re-seed no novo padrão.
            if (
                not template.sections
                or template.sections == LEGACY_DEFAULT_TEMPLATE_SECTIONS
            ):
                template.sections = deepcopy(DEFAULT_TEMPLATE_SECTIONS)
                self.session.commit()
                self.session.refresh(template)
            return template
        template = ContractTemplate(
            user_id=user_id, sections=deepcopy(DEFAULT_TEMPLATE_SECTIONS)
        )
        self.session.add(template)
        self.session.commit()
        self.session.refresh(template)
        return template

    def set_template_sections(
        self, template: ContractTemplate, sections: list[ContractSection]
    ) -> ContractTemplate:
        template.sections = [s.model_dump() for s in sections]
        self.session.commit()
        self.session.refresh(template)
        return template

    # ── Contratos ───────────────────────────────────────────────

    def list_contracts(self, user_id: UUID) -> list[Contract]:
        """Contratos em rascunho. Os finalizados saem da listagem e passam
        a ser visualizados pela Governança. Contratos vinculados a um
        prospecto não captado (reprovado) também saem até o prospecto
        voltar à negociação."""
        return (
            self.session.query(Contract)
            .outerjoin(Prospect, Contract.prospect_id == Prospect.id)
            .filter(
                Contract.user_id == user_id,
                Contract.is_active,
                Contract.status != Contract.STATUS_FINALIZED,
                or_(
                    Prospect.id.is_(None),
                    Prospect.reproved_at.is_(None),
                ),
            )
            .order_by(Contract.created_at.desc())
            .all()
        )

    def get_contract(self, user_id: UUID, contract_id: UUID) -> Contract | None:
        return (
            self.session.query(Contract)
            .filter(
                Contract.id == contract_id,
                Contract.user_id == user_id,
                Contract.is_active,
            )
            .first()
        )

    def next_contract_number(self, user_id: UUID) -> int:
        """Próximo número sequencial do contrato para o usuário (por BPO)."""
        last = (
            self.session.query(func.max(Contract.number))
            .filter(
                Contract.user_id == user_id,
                Contract.number.isnot(None),
            )
            .scalar()
        )
        return int(last or 0) + 1

    def create_contract(
        self,
        user_id: UUID,
        prospect_id: UUID,
        proposal_id: UUID | None,
        client_name: str,
        sections: list[dict],
        number: int | None = None,
        fields: dict | None = None,
        template_sections: list[dict] | None = None,
    ) -> Contract:
        contract = Contract(
            user_id=user_id,
            prospect_id=prospect_id,
            proposal_id=proposal_id,
            client_name=client_name,
            sections=sections,
            template_sections=template_sections or sections,
            number=number,
            fields=fields,
            status=Contract.STATUS_DRAFT,
        )
        self.session.add(contract)
        self.session.commit()
        self.session.refresh(contract)
        return contract

    def set_contract_sections(
        self, contract: Contract, sections: list[ContractSection]
    ) -> Contract:
        raw = [s.model_dump() for s in sections]
        contract.sections = raw
        # Alterações manuais passam a ser o snapshot base de re-render.
        contract.template_sections = deepcopy(raw)
        self.session.commit()
        self.session.refresh(contract)
        return contract

    def set_contract_fields(self, contract: Contract, fields: dict) -> Contract:
        contract.fields = fields
        self.session.commit()
        self.session.refresh(contract)
        return contract

    def set_contract_data(
        self, contract: Contract, sections: list[dict], fields: dict
    ) -> Contract:
        contract.sections = sections
        contract.fields = fields
        self.session.commit()
        self.session.refresh(contract)
        return contract

    def mark_finalized(self, contract: Contract) -> Contract:
        contract.status = Contract.STATUS_FINALIZED
        contract.finalized_at = datetime.now(timezone.utc)
        self.session.commit()
        self.session.refresh(contract)
        return contract

    def soft_delete(self, contract: Contract) -> None:
        contract.is_active = False
        contract.deleted_at = datetime.now(timezone.utc)
        self.session.commit()
