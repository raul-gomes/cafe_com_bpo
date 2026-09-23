import re
from datetime import date, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.prospects.service import ProspectService

from .models import Contract, ContractTemplate
from .repository import ContractRepository

PLACEHOLDER_PATTERN = re.compile(r"\{\{(\w+)\}\}")

_MESES = (
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)


def _data_documento() -> date:
    """Data do documento no fuso de Brasília (com fallback para a hora local)."""
    try:
        return datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    except Exception:
        return datetime.now().date()


_UNIDADES = (
    "",
    "um",
    "dois",
    "três",
    "quatro",
    "cinco",
    "seis",
    "sete",
    "oito",
    "nove",
)
_ESPECIAIS = (
    "dez",
    "onze",
    "doze",
    "treze",
    "catorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
)
_DEZENAS = (
    "",
    "",
    "vinte",
    "trinta",
    "quarenta",
    "cinquenta",
    "sessenta",
    "setenta",
    "oitenta",
    "noventa",
)
_CENTENAS = (
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
)


def _grupo_por_extenso(number: int) -> str:
    """Inteiro 0..999 por extenso em pt-BR (ex.: 125 → 'cento e vinte e cinco')."""
    if number == 0:
        return "zero"
    centena = number // 100
    resto = number % 100
    partes = []
    if centena:
        partes.append("cem" if centena == 1 and resto == 0 else _CENTENAS[centena])
    if resto:
        if resto < 10:
            partes.append(_UNIDADES[resto])
        elif resto < 20:
            partes.append(_ESPECIAIS[resto - 10])
        else:
            dezena = _DEZENAS[resto // 10]
            unidade = _UNIDADES[resto % 10]
            partes.append(f"{dezena} e {unidade}" if unidade else dezena)
    return " e ".join(partes)


def _numero_por_extenso(number: int) -> str:
    """Inteiro positivo por extenso em pt-BR (grupos de trilhão a milhar)."""
    if number == 0:
        return "zero"
    grupos = [
        (1_000_000_000_000, "trilhão", "trilhões"),
        (1_000_000_000, "bilhão", "bilhões"),
        (1_000_000, "milhão", "milhões"),
        (1_000, "mil", "mil"),
        (1, "", ""),
    ]
    partes = []
    for divisor, singular, plural in grupos:
        if number >= divisor:
            quantidade = number // divisor
            if divisor == 1:
                partes.append(_grupo_por_extenso(quantidade))
            elif divisor == 1_000:
                if quantidade == 1:
                    partes.append("mil")
                else:
                    partes.append(f"{_grupo_por_extenso(quantidade)} mil")
            else:
                nome = singular if quantidade == 1 else plural
                partes.append(f"{_grupo_por_extenso(quantidade)} {nome}")
            number %= divisor
    return " e ".join(partes)


def valor_por_extenso(valor: float) -> str:
    """Valor monetário por extenso em pt-BR.

    Ex.: `1250.5` → 'um mil e duzentos e cinquenta reais e cinquenta centavos'.
    """
    try:
        valor = round(float(valor or 0), 2)
    except (TypeError, ValueError):
        valor = 0.0
    reais = int(valor)
    centavos = round((valor - reais) * 100)
    partes = []
    if reais:
        partes.append(
            f"{_numero_por_extenso(reais)} {'real' if reais == 1 else 'reais'}"
        )
    if centavos:
        partes.append(
            f"{_grupo_por_extenso(centavos)} "
            f"{'centavo' if centavos == 1 else 'centavos'}"
        )
    if not partes:
        return "zero reais"
    return " e ".join(partes)


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
    prospect: Prospect,
    proposal: PricingScenario | None,
    contractada: dict | None = None,
) -> dict[str, str]:
    """Monta o dicionário de tokens a partir do prospecto, orçamento e da
    empresa contratada (dados do perfil do usuário).

    Tokens sem valor são omitidos do contexto — o placeholder `{{token}}`
    permanece literal no texto do contrato gerado.
    """
    data_documento = _data_documento()
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
        "dia": str(data_documento.day),
        "mes": _MESES[data_documento.month],
        "ano": str(data_documento.year),
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

    if contractada:
        ctx.update(
            {
                "empresa_contratada": (
                    contractada.get("company_nome_fantasia")
                    or contractada.get("company_razao_social")
                    or contractada.get("company_name")
                    or ""
                ),
                "cnpj_contratada": contractada.get("company_cnpj") or "",
                "endereco_contratada": contractada.get("company_address") or "",
                "socio_contratada": contractada.get("name") or "",
                "email_contratada": (
                    contractada.get("company_professional_email")
                    or contractada.get("email")
                    or ""
                ),
            }
        )

    if proposal is not None:
        result = proposal.result_payload or {}
        breakdown = result.get("breakdown") or {}
        operation = (proposal.input_payload or {}).get("operation") or {}
        term_discount = (proposal.input_payload or {}).get("term_discount") or 0

        ctx.update(
            {
                "valor_mensal": format_money(result.get("final_price")),
                "valor_mensal_extenso": valor_por_extenso(result.get("final_price")),
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

        services = (proposal.input_payload or {}).get("services") or []
        contratados = [
            svc
            for svc in services
            if (svc.get("name") or "").strip() and svc.get("active", True)
        ]
        if contratados:
            final_price = float(result.get("final_price") or 0)
            total_cost = float(
                breakdown.get("total_service_cost")
                or result.get("total_service_cost")
                or 0
            )
            cost_per_minute = float(breakdown.get("cost_per_minute") or 0)

            cost_by_name: dict[str, float] = {}
            for indice, entry in enumerate(breakdown.get("service_costs") or []):
                if isinstance(entry, dict):
                    key = str(entry.get("name") or "").strip()
                    value = entry.get("cost")
                elif indice < len(services):
                    key = str(services[indice].get("name") or "").strip()
                    value = entry
                else:
                    continue
                try:
                    cost_by_name[key] = float(value or 0)
                except (TypeError, ValueError):
                    pass

            def _custo_servico(svc: dict) -> float:
                nome = (svc.get("name") or "").strip()
                if nome in cost_by_name:
                    return cost_by_name[nome]
                try:
                    if svc.get("fixed_value") is not None:
                        return float(svc.get("fixed_value") or 0)
                    return (
                        float(svc.get("minutes_per_execution") or 0)
                        * float(svc.get("monthly_quantity") or 0)
                        * cost_per_minute
                    )
                except (TypeError, ValueError):
                    return 0.0

            linhas = []
            for numero, svc in enumerate(contratados, start=1):
                nome = (svc.get("name") or "").strip()
                custo = _custo_servico(svc)
                total = (
                    round(final_price * (custo / total_cost), 2)
                    if total_cost > 0
                    else 0.0
                )
                quantidade = int(svc.get("monthly_quantity") or 0)
                unitario = total / quantidade if quantidade > 0 else total
                linhas.append(
                    f"| {numero} | {nome} | {format_money(unitario)} | "
                    f"{quantidade} | {format_money(total)} |"
                )
            linhas.append(
                f"| **Total dos serviços** | | | | **{format_money(final_price)}** |"
            )
            ctx["servicos_contratados"] = "\n".join(
                [
                    "| Nº | Serviço contratado | Valor do serviço | Quantidade | Total do serviço |",
                    "|----|--------------------|------------------:|-----------:|------------------:|",
                    *linhas,
                ]
            )

    return {key: value for key, value in ctx.items() if value}


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

    @staticmethod
    def _substitute_sections(
        sections: list[dict], context: dict[str, str]
    ) -> list[dict]:
        return [
            {
                "title": replace_placeholders(section.get("title", ""), context),
                "content": replace_placeholders(section.get("content", ""), context),
            }
            for section in sections
        ]

    def generate_contract(
        self,
        user_id: UUID,
        prospect_id: UUID,
        proposal_id: UUID | None,
        contractada: dict | None = None,
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
        context = build_context(prospect, proposal, contractada)
        sections = self._substitute_sections(template.sections or [], context)

        return self.repository.create_contract(
            user_id=user_id,
            prospect_id=prospect.id,
            proposal_id=proposal.id if proposal else None,
            client_name=prospect.name or "Contrato",
            sections=sections,
        )

    def preview_contract(
        self,
        user_id: UUID,
        contract_id: UUID,
        contractada: dict | None = None,
    ) -> list[dict]:
        """Re-resolve os tokens das seções do contrato com os dados atuais do
        prospecto, do orçamento vinculado e da empresa contratada (perfil).

        Usado na visualização: variáveis mapeadas aparecem preenchidas com os
        valores reais; tokens sem fonte permanecem literais `{{...}}`.
        """
        contract = self.repository.get_contract(user_id, contract_id)
        if not contract:
            raise ValueError("Contrato não encontrado")

        if contract.prospect_id is None:
            return contract.sections or []

        prospect = self.prospect_service.repository.get_by_id(
            contract.prospect_id, user_id
        )
        if not prospect:
            return contract.sections or []

        proposal = None
        if contract.proposal_id is not None:
            proposal = self.proposal_repo.get_scenario_by_id(
                user_id, contract.proposal_id
            )

        context = build_context(prospect, proposal, contractada)
        return self._substitute_sections(contract.sections or [], context)

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
