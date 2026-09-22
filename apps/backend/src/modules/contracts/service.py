import re
from uuid import UUID

from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.prospects.service import ProspectService

from .models import Contract, ContractTemplate
from .repository import ContractRepository

PLACEHOLDER_PATTERN = re.compile(r"\{\{(\w+)\}\}")


def replace_placeholders(text: str, context: dict[str, str]) -> str:
    """Substitui placeholders `{{token}}` pelos valores do contexto.

    Tokens desconhecidos (ou sem valor) permanecem como estão no texto.
    """

    def _sub(match: re.Match) -> str:
        key = match.group(1).strip().lower()
        return context.get(key, match.group(0))

    return PLACEHOLDER_PATTERN.sub(_sub, text)


def format_money(value: float) -> str:
    """Formata valores como moeda pt-BR: `1250.0` → `R$ 1.250,00`."""
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        number = 0
    sign = "-" if number < 0 else ""
    number = abs(number)
    integer, _, cents = f"{number:.2f}".partition(".")
    integer = re.sub(r"\B(?=(\d{3})+(?!\d))", ".", integer)
    return f"{sign}R$ {integer},{cents}"


def build_context(
    prospect: Prospect, proposal: PricingScenario | None
) -> dict[str, str]:
    """Monta o dicionário de tokens a partir do prospecto e do orçamento."""
    ctx: dict[str, str] = {
        "nome": prospect.name or "",
        "cnpj": prospect.cnpj or "",
        "telefone": prospect.phone or "",
        "email": prospect.email or "",
        "segmento": prospect.segment or "",
        "rua": prospect.street or "",
        "numero": prospect.number or "",
        "complemento": prospect.complement or "",
        "bairro": prospect.neighborhood or "",
        "cidade": prospect.city or "",
        "uf": prospect.state or "",
        "cep": prospect.cep or "",
        "endereco": "".join(
            part
            for part in [
                prospect.street or "",
                prospect.number and f", {prospect.number}",
                prospect.neighborhood and f" - {prospect.neighborhood}",
                prospect.city and f", {prospect.city}",
                prospect.state and f" - {prospect.state}",
            ]
            if part
        ),
    }

    if proposal is not None:
        result = proposal.result_payload or {}
        breakdown = result.get("breakdown") or {}
        operation = (proposal.input_payload or {}).get("operation") or {}
        term_discount = (proposal.input_payload or {}).get("term_discount") or 0

        ctx.update(
            {
                "valor_mensal": format_money(result.get("final_price")),
                "valor_servicos": format_money(
                    result.get("total_service_cost")
                    or breakdown.get("total_service_cost")
                ),
                "valor_sem_desconto": format_money(result.get("price_before_discount")),
                "pessoas": str(operation.get("people_count") or ""),
                "horas": str(operation.get("hours_per_month") or ""),
                "complexidade": str(
                    (proposal.input_payload or {}).get("complexity") or ""
                ),
                "faturamento": format_money(
                    (proposal.input_payload or {}).get("revenue")
                ),
                "desconto_prazo": f"{round(float(term_discount or 0) * 100)}%",
            }
        )

    return ctx


class ContractService:
    def __init__(
        self,
        repository: ContractRepository,
        prospect_service: ProspectService,
        proposal_repo,
    ):
        self.repository = repository
        self.prospect_service = prospect_service
        self.proposal_repo = proposal_repo

    # ── Modelo padrão ───────────────────────────────────────────

    def get_template(self, user_id: UUID) -> ContractTemplate:
        return self.repository.get_or_create_template(user_id)

    def update_template(self, user_id: UUID, sections) -> ContractTemplate:
        template = self.repository.get_or_create_template(user_id)
        return self.repository.set_template_sections(template, sections)

    # ── Contratos ───────────────────────────────────────────────

    def generate_contract(
        self,
        user_id: UUID,
        prospect_id: UUID,
        proposal_id: UUID | None,
    ) -> Contract:
        prospect = self.prospect_service.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError("Prospect não encontrado")

        proposal = None
        if proposal_id is not None:
            proposal = self.proposal_repo.get_scenario_by_id(user_id, proposal_id)
            if not proposal:
                raise ValueError("Orçamento não encontrado")

        template = self.repository.get_or_create_template(user_id)
        context = build_context(prospect, proposal)
        sections = [
            {
                "title": replace_placeholders(section.get("title", ""), context),
                "content": replace_placeholders(section.get("content", ""), context),
            }
            for section in template.sections or []
        ]

        return self.repository.create_contract(
            user_id=user_id,
            prospect_id=prospect.id,
            proposal_id=proposal.id if proposal else None,
            client_name=prospect.name or "Contrato",
            sections=sections,
        )

    def update_contract(self, user_id: UUID, contract_id: UUID, sections) -> Contract:
        contract = self.repository.get_contract(user_id, contract_id)
        if not contract:
            raise ValueError("Contrato não encontrado")
        self._ensure_editable(contract)
        return self.repository.set_contract_sections(contract, sections)

    def finalize(
        self, user_id: UUID, contract_id: UUID, client_repo
    ) -> tuple[Contract, str | None]:
        contract = self.repository.get_contract(user_id, contract_id)
        if not contract:
            raise ValueError("Contrato não encontrado")
        self._ensure_editable(contract)

        finalized = self.repository.mark_finalized(contract)
        client_id = None

        if contract.prospect_id is not None:
            converted = self.prospect_service.convert_prospect(
                contract.prospect_id, user_id, client_repo
            )
            client_id = converted.client_id

        return finalized, client_id

    def delete(self, user_id: UUID, contract_id: UUID) -> None:
        contract = self.repository.get_contract(user_id, contract_id)
        if not contract:
            raise ValueError("Contrato não encontrado")
        if contract.status == Contract.STATUS_FINALIZED:
            raise PermissionError("Contrato finalizado não pode ser excluído")
        self.repository.soft_delete(contract)

    @staticmethod
    def _ensure_editable(contract: Contract) -> None:
        if contract.status == Contract.STATUS_FINALIZED:
            raise PermissionError("Contrato finalizado não pode ser modificado")
