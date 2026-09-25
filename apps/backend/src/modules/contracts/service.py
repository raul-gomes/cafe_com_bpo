import re
from copy import deepcopy
from datetime import date, datetime
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect
from src.modules.prospects.service import ProspectService

from .fields import _servico_rows
from .models import Contract, ContractTemplate
from .repository import ContractRepository

PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}")

IF_START_RE = re.compile(r"{%\s*if\s+([\w.]+)\s*%}")
IF_END_RE = re.compile(r"{%\s*endif\s*%}")
FOR_START_RE = re.compile(r"{%\s*for\s+(\w+)\s+in\s+([\w.]+)\s*%}")
FOR_END_RE = re.compile(r"{%\s*endfor\s*%}")
_BLOCK_TAGS_RE = re.compile(r"{%\s*(if|endif|for|endfor)\b[^%]*%}")

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

_HEURISTIC_FALSE = {"", "0", "false", "no", "n", "nao", "não", "f"}


def _data_documento() -> date:
    """Data do documento no fuso de Brasília (com fallback para a hora local)."""
    try:
        return datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    except Exception:
        return datetime.now().date()


def _data_extenso(value: date) -> str:
    """Ex.: 22 de setembro de 2026."""
    return f"{value.day} de {_MESES[value.month]} de {value.year}"


def _data_curta(value: Any) -> str:
    """Converte ISO 'YYYY-MM-DD' em 'DD/MM/AAAA'; mantém texto livre como está."""
    if not isinstance(value, str):
        return "" if value is None else str(value)
    m = re.fullmatch(r"\s*(\d{4})-(\d{2})-(\d{2})\s*", value)
    if m:
        return f"{m.group(3)}/{m.group(2)}/{m.group(1)}"
    return value


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


def parse_money(value: Any) -> float:
    """Converte `valor_implantacao` (ex.: '1500,00' ou 1500) para float."""
    if value in (None, ""):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace("R$", "").replace(" ", "").replace(".", "")
    cleaned = cleaned.replace(",", ".")
    try:
        return round(float(cleaned), 2)
    except (TypeError, ValueError):
        return 0.0


def _is_truthy(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() not in _HEURISTIC_FALSE
    if isinstance(value, (list, dict, tuple)):
        return len(value) > 0
    return bool(value)


def _tokenize(text: str) -> list[tuple[str, Any]]:
    parts: list[tuple[str, Any]] = []
    idx = 0
    for match in _BLOCK_TAGS_RE.finditer(text):
        if match.start() > idx:
            parts.append(("text", text[idx : match.start()]))
        tag = match.group(0)
        keyword = match.group(1)
        if keyword == "if":
            var = IF_START_RE.match(tag).group(1)
            parts.append(("if", var))
        elif keyword == "for":
            varname, listname = FOR_START_RE.match(tag).groups()
            parts.append(("for", (varname, listname)))
        elif keyword == "endif":
            parts.append(("endif", None))
        else:
            parts.append(("endfor", None))
        idx = match.end()
    if idx < len(text):
        parts.append(("text", text[idx:]))
    return parts


def _substitute_tokens(text: str, context: dict[str, Any]) -> str:
    def _sub(match: re.Match) -> str:
        name = match.group(1)
        if name in context:
            value = context[name]
            if isinstance(value, (str, int, float)):
                return str(value)
            return match.group(0)
        if "." in name:
            varname, _, field = name.partition(".")
            item = context.get(varname)
            if isinstance(item, dict) and field in item:
                return str(item[field])
        return match.group(0)

    return PLACEHOLDER_PATTERN.sub(_sub, text)


def _render_parts(parts: list[tuple[str, Any]], context: dict[str, Any]) -> str:
    out: list[str] = []
    i = 0
    while i < len(parts):
        kind, value = parts[i]
        if kind == "text":
            out.append(_substitute_tokens(value, context))
            i += 1
            continue
        if kind == "if":
            depth = 1
            j = i + 1
            while j < len(parts) and depth:
                inner_kind = parts[j][0]
                if inner_kind == "if":
                    depth += 1
                elif inner_kind == "endif":
                    depth -= 1
                j += 1
            inner = parts[i + 1 : j - 1]
            if _is_truthy(context.get(value)):
                out.append(_render_parts(inner, context))
            i = j
            continue
        if kind == "for":
            varname, listname = value
            depth = 1
            j = i + 1
            while j < len(parts) and depth:
                inner_kind = parts[j][0]
                if inner_kind == "for":
                    depth += 1
                elif inner_kind == "endfor":
                    depth -= 1
                j += 1
            inner = parts[i + 1 : j - 1]
            items = context.get(listname) or []
            for item in items:
                scoped = dict(context)
                scoped[varname] = item
                out.append(_render_parts(inner, scoped))
            i = j
            continue
        i += 1
    return "".join(out)


def render_text(text: str, context: dict[str, Any]) -> str:
    """Substitui `{{token}}`, remove condicionais `{% if %}` vazias e repete
    loops `{% for x in lista %}` do conteúdo de uma seção do contrato."""
    return _render_parts(_tokenize(text), context)


def replace_placeholders(text: str, context: dict[str, str]) -> str:
    """Compat: substitui `{{token}}`; tokens desconhecidos permanecem literais."""
    return _substitute_tokens(text, context)


def _build_contratante(prospect: Prospect) -> dict[str, str]:
    endereco = "".join(
        part
        for part in [
            prospect.street or "",
            prospect.number and f", {prospect.number}",
            prospect.neighborhood and f" - {prospect.neighborhood}",
            prospect.city and f", {prospect.city}",
            prospect.state and f" - {prospect.state}",
        ]
        if part
    )
    return {
        "contratante_razao_social": prospect.name or "",
        "contratante_cnpj": prospect.cnpj or "",
        "contratante_endereco": endereco,
        "contratante_cidade": prospect.city or "",
        "contratante_uf": prospect.state or "",
        "contratante_cep": prospect.cep or "",
        "contratante_email": prospect.email or "",
        "contratante_email_notificacoes": prospect.email or "",
        "contratante_representante_nome": prospect.representante_nome or "",
        "contratante_representante_cargo": prospect.representante_cargo or "",
        "contratante_representante_cpf": prospect.representante_cpf or "",
        "contratante_representante_email": prospect.representante_email or "",
        "contratante_representante_telefone": prospect.representante_telefone or "",
    }


def _build_contratada(contractada: dict | None) -> dict[str, str]:
    if not contractada:
        return {}
    razao_social = (
        contractada.get("company_razao_social")
        or contractada.get("company_nome_fantasia")
        or contractada.get("company_name")
        or ""
    )
    email = (
        contractada.get("company_professional_email") or contractada.get("email") or ""
    )
    endereco = "".join(
        part
        for part in [
            contractada.get("company_street") or "",
            contractada.get("company_number") and f", {contractada['company_number']}",
            contractada.get("company_complement")
            and f", {contractada['company_complement']}",
            contractada.get("company_neighborhood")
            and f" - {contractada['company_neighborhood']}",
        ]
        if part
    )
    if not endereco:
        endereco = contractada.get("company_address") or ""
    return {
        "contratada_razao_social": razao_social,
        "contratada_nome_fantasia": contractada.get("company_nome_fantasia") or "",
        "contratada_cnpj": contractada.get("company_cnpj") or "",
        "contratada_endereco": endereco,
        "contratada_cidade": contractada.get("company_city") or "",
        "contratada_uf": contractada.get("company_state") or "",
        "contratada_cep": contractada.get("company_cep") or "",
        "contratada_representante_nome": contractada.get("name") or "",
        "contratada_representante_cargo": contractada.get("representante_cargo") or "",
        "contratada_representante_cpf": contractada.get("cpf") or "",
        "contratada_email": email,
        "contratada_email_notificacoes": email,
    }


def _proposta_identificacao(
    proposal: PricingScenario | None,
) -> tuple[str, str]:
    if proposal is None:
        return "", ""
    numero = f"ORC-{proposal.id.hex[:8].upper()}" if proposal.id else ""
    data_str = ""
    if proposal.created_at:
        try:
            data_str = _data_extenso(proposal.created_at.date())
        except (AttributeError, ValueError):
            data_str = ""
    return numero, data_str


def _servico_listas(
    proposal: PricingScenario | None, extra: dict[str, Any]
) -> dict[str, Any]:
    recorrentes, pontuais = _servico_rows(proposal)
    recorrentes = [
        {
            **row,
            "valor": (
                format_money(row["valor"])
                if isinstance(row.get("valor"), (int, float))
                else row.get("valor", "")
            ),
        }
        for row in recorrentes
    ]

    def _apply(listname: str, default: list[dict]) -> list[dict]:
        if not isinstance(extra.get(listname), list):
            return default
        rows = []
        for row in extra[listname]:
            if not isinstance(row, dict):
                continue
            merged = dict(default[len(rows)]) if len(rows) < len(default) else {}
            merged.update(
                {
                    k: (v if v not in (None, "") else merged.get(k, ""))
                    for k, v in row.items()
                }
            )
            rows.append(merged)
        if default and len(rows) < len(default):
            rows.extend(default[len(rows) :])
        return rows

    return {
        "servicos": _apply("servicos", recorrentes),
        "servicos_pontuais": _apply("servicos_pontuais", pontuais),
    }


def build_context(
    prospect: Prospect,
    proposal: PricingScenario | None,
    contractada: dict | None = None,
    extra: dict[str, Any] | None = None,
    contrato_numero: str = "",
) -> dict[str, Any]:
    """Monta o contexto de tokens a partir do prospecto (CONTRATANTE), do
    orçamento (PROP), da empresa do usuário (CONTRATADA) e dos campos
    informados no modal (`extra`)."""

    extra = extra or {}

    data_documento = _data_documento()
    proposta_numero, proposta_data = _proposta_identificacao(proposal)

    ctx: dict[str, Any] = {
        "nome": prospect.name or "",
        "cnpj": prospect.cnpj or "",
        "telefone": prospect.phone or "",
        "email": prospect.email or "",
        "segmento": prospect.segment or "",
    }
    ctx.update(_build_contratante(prospect))
    ctx.update(_build_contratada(contractada))
    ctx.update(
        {
            "contrato_numero": contrato_numero or "",
            "contrato_data_extenso": _data_extenso(data_documento),
            "contrato_cidade": prospect.city or "",
            "proposta_numero": proposta_numero,
            "proposta_data": proposta_data,
            # Operação (padrões do plano; sobrescritos pelo extra)
            "sistema_gestao": "",
            "sistema_titular": "CONTRATANTE",
            "horario_atendimento": "de segunda a sexta, das 9h às 18h (horário de Brasília)",
            "canais_operacionais": "e-mail, grupo de WhatsApp e pasta compartilhada",
            "prazo_envio_documentos_horas": "24",
            "prazo_atendimento_horas": "24",
            "plataformas_dados": "Conta Azul, Google Drive e Café BPO",
            "contratada_encarregado_contato": (contractada or {}).get(
                "company_professional_email"
            )
            or (contractada or {}).get("email")
            or "",
            # Financeiro e prazo
            "dia_vencimento": "10",
            "primeiro_vencimento": "",
            "forma_pagamento": "boleto bancário",
            "valor_implantacao": "",
            "valor_implantacao_extenso": "",
            "condicao_implantacao": "paga em parcela única, junto com a primeira mensalidade",
            "indice_reajuste": "IPCA/IBGE",
            "data_inicio": "",
            "prazo_minimo_meses": "3",
            "aviso_previo_dias": "30",
            "dias_suspensao_inadimplencia": "7",
            "foro_comarca": "",
            "autoriza_citacao_cliente": True,
        }
    )
    ctx.update(_servico_listas(proposal, extra))

    # Implantação (cláusula 7.6): puxada do orçamento — soma dos valores fixos
    # dos serviços pontuais ativos. O modal pode sobrescrever via `extra`.
    if proposal is not None and not extra.get("valor_implantacao"):
        services = (proposal.input_payload or {}).get("services") or []
        pontuais = [
            svc.get("fixed_value") or 0
            for svc in services
            if svc.get("active", True)
            and (svc.get("type") in ("fixed", "pontual") or svc.get("is_pontual"))
        ]
        if pontuais:
            ctx["valor_implantacao"] = sum(float(v) for v in pontuais)

    # Volumes do Anexo I: derivados dos serviços recorrentes do orçamento
    # (item = nome do serviço, limite = quantidade mensal).
    if isinstance(extra.get("volumes"), list):
        ctx["volumes"] = extra["volumes"]
    elif proposal is not None:
        services = (proposal.input_payload or {}).get("services") or []
        volumes = [
            {
                "item": str(svc.get("name") or "").strip(),
                "limite": str(int(svc.get("monthly_quantity") or 1)),
            }
            for svc in services
            if svc.get("active", True)
            and str(svc.get("name") or "").strip()
            and not (svc.get("type") in ("fixed", "pontual") or svc.get("is_pontual"))
        ]
        ctx["volumes"] = volumes or [
            {"item": "Lançamentos", "limite": ""},
            {"item": "Notas fiscais (NFS-e)", "limite": ""},
            {"item": "Contas bancárias em conciliação", "limite": ""},
        ]
    else:
        ctx["volumes"] = [
            {"item": "Lançamentos", "limite": ""},
            {"item": "Notas fiscais (NFS-e)", "limite": ""},
            {"item": "Contas bancárias em conciliação", "limite": ""},
        ]
    ctx["testemunhas"] = (
        extra["testemunhas"] if isinstance(extra.get("testemunhas"), list) else []
    )

    # Conteúdo de serviço contratado (mantido p/ compatibilidade com templates legados)
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

    # Overlay dos campos informados no modal (escalares)
    for key, value in extra.items():
        if (
            key in ctx
            and isinstance(value, (str, int, float, bool))
            and value not in (None, "")
        ):
            ctx[key] = value

    # Derivações dependentes
    raw_data_inicio = ctx["data_inicio"] or datetime.now().date().isoformat()
    ctx["data_inicio"] = _data_curta(raw_data_inicio)
    ctx["primeiro_vencimento"] = _data_curta(
        ctx["primeiro_vencimento"] or raw_data_inicio
    )
    if ctx.get("valor_implantacao"):
        ctx["valor_implantacao"] = format_money(parse_money(ctx["valor_implantacao"]))
        ctx["valor_implantacao_extenso"] = valor_por_extenso(
            parse_money(ctx["valor_implantacao"])
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

    @staticmethod
    def _substitute_sections(
        sections: list[dict], context: dict[str, Any]
    ) -> list[dict]:
        return [
            {
                "title": _substitute_tokens(section.get("title", ""), context),
                "content": render_text(section.get("content", ""), context),
            }
            for section in sections
        ]

    def _load(self, user_id: UUID, prospect_id: UUID, proposal_id: UUID | None):
        prospect = self.prospect_service.repository.get_by_id(prospect_id, user_id)
        if not prospect:
            raise ValueError("Prospect não encontrado")
        proposal = None
        if proposal_id is not None:
            proposal = self.proposal_repo.get_scenario_by_id(user_id, proposal_id)
            if not proposal:
                raise ValueError("Orçamento não encontrado")
        return prospect, proposal

    def missing_fields(
        self,
        user_id: UUID,
        prospect_id: UUID,
        proposal_id: UUID | None,
        contractada: dict | None = None,
    ) -> list[dict]:
        """Descritores dos campos sem fonte no banco para o modal de geração."""
        prospect, proposal = self._load(user_id, prospect_id, proposal_id)
        from .fields import all_missing_field_descriptors

        return all_missing_field_descriptors(prospect, proposal, contractada)

    def _next_number(self, user_id: UUID) -> int:
        return self.repository.next_contract_number(user_id)

    def generate_contract(
        self,
        user_id: UUID,
        prospect_id: UUID,
        proposal_id: UUID | None,
        contractada: dict | None = None,
        fields: dict | None = None,
    ) -> Contract:
        prospect, proposal = self._load(user_id, prospect_id, proposal_id)

        template = self.repository.get_or_create_template(user_id)
        numero = self._next_number(user_id)
        context = build_context(
            prospect,
            proposal,
            contractada,
            extra=fields or {},
            contrato_numero=str(numero).zfill(4),
        )
        # Snapshot do template com tokens ainda sem substituir: permite
        # re-render posteriormente ao editar os dados do modal.
        template_sections = deepcopy(template.sections or [])
        sections = self._substitute_sections(template_sections, context)

        return self.repository.create_contract(
            user_id=user_id,
            prospect_id=prospect.id,
            proposal_id=proposal.id if proposal else None,
            client_name=prospect.name or "Contrato",
            sections=sections,
            template_sections=template_sections,
            number=numero,
            fields={k: v for k, v in (fields or {}).items() if v not in (None, "")},
        )

    def preview_contract(
        self,
        user_id: UUID,
        contract_id: UUID,
        contractada: dict | None = None,
    ) -> list[dict]:
        """Re-resolve os tokens do snapshot com os dados atuais + campos gravados."""
        contract = self.repository.get_contract(user_id, contract_id)
        if not contract:
            raise ValueError("Contrato não encontrado")

        # Snapshot em branco (rascunho criado sem prospecto): retorna como está.
        if contract.prospect_id is None:
            return contract.sections or []

        raw = contract.template_sections or contract.sections
        if not raw:
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

        context = build_context(
            prospect,
            proposal,
            contractada,
            extra=contract.fields or {},
            contrato_numero=str(contract.number or "").zfill(4),
        )
        return self._substitute_sections(raw, context)

    def update_contract_fields(
        self,
        user_id: UUID,
        contract_id: UUID,
        fields: dict,
        contractada: dict | None = None,
    ) -> Contract:
        """Atualiza os campos do modal de um rascunho e re-resolve as seções."""
        contract = self.repository.get_contract(user_id, contract_id)
        if not contract:
            raise ValueError("Contrato não encontrado")
        self._ensure_editable(contract)

        if contract.prospect_id is None:
            return self.repository.set_contract_fields(
                contract,
                {k: v for k, v in fields.items() if v not in (None, "")},
            )

        prospect = self.prospect_service.repository.get_by_id(
            contract.prospect_id, user_id
        )
        proposal = None
        if contract.proposal_id is not None:
            proposal = self.proposal_repo.get_scenario_by_id(
                user_id, contract.proposal_id
            )

        merged = dict(contract.fields or {})
        for key, value in fields.items():
            if value not in (None, ""):
                merged[key] = value

        raw = contract.template_sections or contract.sections
        context = build_context(
            prospect,
            proposal,
            contractada,
            extra=merged,
            contrato_numero=str(contract.number or "").zfill(4),
        )
        sections = self._substitute_sections(raw, context)
        return self.repository.set_contract_data(
            contract, sections=sections, fields=merged
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
