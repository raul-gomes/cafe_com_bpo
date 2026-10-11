from copy import deepcopy
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.modules.companies.models import Company
from src.modules.companies.representative import resolve_representative

from .default_template import (
    DEFAULT_TEMPLATE_SECTIONS,
    LEGACY_DEFAULT_TEMPLATE_SECTIONS,
)
from .models import Contract, ContractTemplate
from .schemas import ContractSection


class ContractRepository:
    def __init__(self, session: Session):
        self.session = session

    # ── Negócio ────────────────────────────────────────────────

    def get_company(self, company_id: UUID, user_id: UUID) -> Company | None:
        """Empresa dona do negócio, filtrada pelo dono do usuário.

        O filtro de dono mora aqui, e não no serviço, porque o `company_id` chega
        do corpo da requisição: uma empresa de outro usuário precisa dar o mesmo
        "não encontrado" que uma inexistente, senão o endpoint serve de verificação
        de existência de negócio alheio. `is_active`/`deleted_at` é a desativação
        da regra §16 — empresa arquivada não assina contrato.
        """
        return (
            self.session.query(Company)
            .filter(
                Company.id == company_id,
                Company.user_id == user_id,
                Company.is_active,
                Company.deleted_at.is_(None),
            )
            .first()
        )

    def get_representative(self, company: Company) -> dict[str, str | None]:
        """Representante da empresa para os tokens `contratante_representante_*`.

        Fonte única em `companies.representative`: contato ativo primeiro, colunas
        legadas do prospecto depois. Mesma resolução da Governança, para o
        contrato nunca divergir do que a tela mostra.
        """
        return resolve_representative(self.session, company)

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
        a ser visualizados pela Governança. Contratos vinculados a uma empresa
        não captada (reprovada) também saem até o negócio voltar à negociação.

        O filtro de "não captado" lê `companies.reproved_at` — o estado do
        negócio mora na empresa, e o par prospecto/cliente colapsa nela. Já o
        convertido não entra aqui: quem some por conversão é o contrato
        finalizado, e a Governança mostra os dois pelo detalhe.
        """
        return (
            self.session.query(Contract)
            .outerjoin(Company, Contract.company_id == Company.id)
            .filter(
                Contract.user_id == user_id,
                Contract.is_active,
                Contract.status != Contract.STATUS_FINALIZED,
                or_(
                    Company.id.is_(None),
                    Company.reproved_at.is_(None),
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
        company_id: UUID,
        client_name: str,
        sections: list[dict],
        proposal_id: UUID | None = None,
        prospect_id: UUID | None = None,
        number: int | None = None,
        fields: dict | None = None,
        template_sections: list[dict] | None = None,
    ) -> Contract:
        """Grava o contrato novo, já apontado para a empresa dona do negócio.

        `prospect_id` é a coluna legada que o `finalize` usa para converter o
        negócio: o serviço só a preenche quando a empresa ainda é um prospecto.
        """
        contract = Contract(
            user_id=user_id,
            company_id=company_id,
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

    def delete_by_company(self, user_id: UUID, company_id: UUID) -> list[Contract]:
        """Arquiva (soft delete) os contratos do usuário de uma empresa — usado
        quando o prospecto dono do negócio é excluído.

        Filtra por `company_id` e não pela coluna legada: o dono do contrato é a
        empresa, e é a empresa que sobrevive ao colapso da conversão. Quem
        conhece o vínculo empresa↔prospecto é quem chama (o módulo de prospects).
        """
        contracts = (
            self.session.query(Contract)
            .filter(
                Contract.user_id == user_id,
                Contract.company_id == company_id,
                Contract.is_active,
            )
            .all()
        )
        now = datetime.now(timezone.utc)
        for contract in contracts:
            contract.is_active = False
            contract.deleted_at = now
        self.session.commit()
        return contracts
