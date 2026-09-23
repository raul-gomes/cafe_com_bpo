from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from .default_template import DEFAULT_TEMPLATE_SECTIONS
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
            if not template.sections:
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
        return (
            self.session.query(Contract)
            .filter(Contract.user_id == user_id, Contract.is_active)
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

    def create_contract(
        self,
        user_id: UUID,
        prospect_id: UUID,
        proposal_id: UUID | None,
        client_name: str,
        sections: list[dict],
    ) -> Contract:
        contract = Contract(
            user_id=user_id,
            prospect_id=prospect_id,
            proposal_id=proposal_id,
            client_name=client_name,
            sections=sections,
            status=Contract.STATUS_DRAFT,
        )
        self.session.add(contract)
        self.session.commit()
        self.session.refresh(contract)
        return contract

    def set_contract_sections(
        self, contract: Contract, sections: list[ContractSection]
    ) -> Contract:
        contract.sections = [s.model_dump() for s in sections]
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
