"""Catálogo de campos do contrato sem fonte no banco.

Usado pelo endpoint `POST /contracts/missing-fields` para montar o formulário
que pede ao usuário os dados que não existem no banco (perfil do BPO,
prospecto ou orçamento) no momento da geração do contrato.

Cada campo descritor carrega o que o frontend precisa para renderizar o modal:

- ``key``: token resolvido no contrato (ex.: ``sistema_gestao``).
- ``label``: rótulo exibido ao usuário.
- ``kind``: ``text``, ``number``, ``date``, ``select``, ``boolean``, ``money``
  ou ``list`` (tabela dinâmica de linhas).
- ``default``: valor sugerido (defaults do plano de implementação).
- ``rows``/``list_fields``: para campos de lista (serviços, volumes, testemunhas).
"""

from datetime import datetime
from typing import Any

from src.modules.proposals.models import PricingScenario
from src.modules.prospects.models import Prospect

# Listas de colocação dos serviços no Anexo I.
SERVICO_RECORRENTE = "servicos"
SERVICO_PONTUAL = "servicos_pontuais"

# Token de CONTRATADA que já tem fonte no perfil do BPO (dict `contractada`).
# Quando o valor correspondente existe no perfil, o campo deixa de ser
# solicitado no modal — o token é resolvido automaticamente na geração.
CONTRATADA_SOURCE_KEYS: dict[str, str] = {
    "contratada_cidade": "company_city",
    "contratada_uf": "company_state",
    "contratada_cep": "company_cep",
    "contratada_representante_cpf": "cpf",
    "contratada_representante_cargo": "representante_cargo",
}

# Token de CONTRATANTE que já tem fonte no prospecto (atributos do model
# `Prospect`). Quando o valor correspondente existe, o campo deixa de ser
# solicitado no modal — o token é resolvido automaticamente na geração.
CONTRATANTE_SOURCE_KEYS: dict[str, str] = {
    "contratante_representante_nome": "representante_nome",
    "contratante_representante_cargo": "representante_cargo",
    "contratante_representante_cpf": "representante_cpf",
    "contratante_representante_email": "representante_email",
    "contratante_representante_telefone": "representante_telefone",
}

# Campos de lista que formam tabelas dinâmicas no modal.
LIST_TYPES = {
    "testemunhas": {
        "label": "Testemunhas (opcional)",
        "hint": "Assinatura eletrônica dispensa testemunhas (CPC, art. 784, § 4º). Deixe vazio para remover o bloco.",
        "list_fields": [
            {"key": "nome", "label": "Nome", "kind": "text"},
            {"key": "cpf", "label": "CPF", "kind": "text"},
        ],
        "default_rows": [],
    },
}

# Campos escalares sem fonte no banco, com o padrão sugerido no plano de
# implementação (`docs/Campos_Contrato_BPO_para_Raul.md`).
SCALAR_FIELDS: list[dict[str, Any]] = [
    {
        "group": "Partes – CONTRATADA",
        "fields": [
            {
                "key": "contratada_cidade",
                "label": "Cidade da sede (CONTRATADA)",
                "kind": "text",
                "default": "",
            },
            {
                "key": "contratada_uf",
                "label": "UF da sede (CONTRATADA)",
                "kind": "text",
                "default": "",
            },
            {
                "key": "contratada_cep",
                "label": "CEP da sede (CONTRATADA)",
                "kind": "text",
                "default": "",
            },
            {
                "key": "contratada_representante_cargo",
                "label": "Cargo do representante (CONTRATADA)",
                "kind": "text",
                "default": "",
            },
            {
                "key": "contratada_representante_cpf",
                "label": "CPF do representante (CONTRATADA)",
                "kind": "text",
                "default_key": "cpf",
            },
        ],
    },
    {
        "group": "Partes – CONTRATANTE",
        "fields": [
            {
                "key": "contratante_representante_nome",
                "label": "Nome do representante (CONTRATANTE)",
                "kind": "text",
                "default": "",
            },
            {
                "key": "contratante_representante_cargo",
                "label": "Cargo do representante (CONTRATANTE)",
                "kind": "text",
                "default": "",
            },
            {
                "key": "contratante_representante_cpf",
                "label": "CPF do representante (CONTRATANTE)",
                "kind": "text",
                "default": "",
            },
        ],
    },
    {
        "group": "Operação",
        "fields": [
            {
                "key": "sistema_gestao",
                "label": "Sistema de gestão financeira",
                "kind": "text",
                "default": "",
            },
            {
                "key": "sistema_titular",
                "label": "Titular da licença do sistema",
                "kind": "select",
                "options": ["CONTRATANTE", "CONTRATADA"],
                "default": "CONTRATANTE",
            },
            {
                "key": "horario_atendimento",
                "label": "Horário de atendimento",
                "default": "de segunda a sexta, das 9h às 18h (horário de Brasília)",
            },
            {
                "key": "canais_operacionais",
                "label": "Canais operacionais",
                "default": "e-mail, grupo de WhatsApp e pasta compartilhada",
            },
            {
                "key": "prazo_envio_documentos_horas",
                "label": "Prazo de envio de documentos (horas úteis)",
                "kind": "number",
                "default": "24",
            },
            {
                "key": "prazo_atendimento_horas",
                "label": "Prazo de atendimento a solicitações (horas úteis)",
                "kind": "number",
                "default": "24",
            },
            {
                "key": "plataformas_dados",
                "label": "Plataformas onde os dados ficam armazenados",
                "default": "Conta Azul, Google Drive e Café BPO",
            },
            {
                "key": "contratada_encarregado_contato",
                "label": "Contato do encarregado de dados (LGPD)",
                "default_key": "email",
            },
        ],
    },
    {
        "group": "Financeiro e prazo",
        "fields": [
            {
                "key": "dia_vencimento",
                "label": "Dia de vencimento da mensalidade",
                "kind": "number",
                "default": "10",
                "required": True,
            },
            {
                "key": "primeiro_vencimento",
                "label": "Primeiro vencimento",
                "kind": "date",
                "default_key": "data_inicio",
                "required": True,
            },
            {
                "key": "forma_pagamento",
                "label": "Forma de pagamento",
                "default": "boleto bancário",
                "required": True,
            },
            {
                "key": "condicao_implantacao",
                "label": "Condição de pagamento da implantação",
                "default": "paga em parcela única, junto com a primeira mensalidade",
            },
            {
                "key": "indice_reajuste",
                "label": "Índice de reajuste",
                "default": "IPCA/IBGE",
            },
            {
                "key": "data_inicio",
                "label": "Data de início do contrato",
                "kind": "date",
                "default_key": "hoje",
                "required": True,
            },
            {
                "key": "prazo_minimo_meses",
                "label": "Prazo mínimo (meses)",
                "kind": "number",
                "default": "3",
            },
            {
                "key": "aviso_previo_dias",
                "label": "Aviso prévio (dias)",
                "kind": "number",
                "default": "30",
            },
            {
                "key": "dias_suspensao_inadimplencia",
                "label": "Dias de atraso para suspensão",
                "kind": "number",
                "default": "7",
            },
            {
                "key": "foro_comarca",
                "label": "Foro da comarca",
                "hint": "A comarca será da CONTRATADA.",
            },
            {
                "key": "autoriza_citacao_cliente",
                "label": "Autoriza menção como cliente em materiais institucionais (cláusula 9.4)",
                "kind": "boolean",
                "default": True,
            },
        ],
    },
]


def _contractada_default(contractada: dict | None, key: str) -> str:
    return str((contractada or {}).get(key) or "")


def describe_list_fields() -> list[dict[str, Any]]:
    return [
        {
            "group": "Assinaturas",
            "field": {
                "key": "testemunhas",
                "label": LIST_TYPES["testemunhas"]["label"],
                "kind": "list",
                "hint": LIST_TYPES["testemunhas"]["hint"],
                "list_fields": LIST_TYPES["testemunhas"]["list_fields"],
                "rows": [],
            },
        },
    ]


def _servico_rows(proposal: PricingScenario | None) -> tuple[list[dict], list[dict]]:
    """Separa serviços recorrentes (`servicos`) de pontuais (`servicos_pontuais`).

    A frequência dos recorrentes é derivada da quantidade mensal do orçamento.
    Descrição e prazo não têm fonte no banco — ficam em branco para o modal.
    """
    recorrentes: list[dict] = []
    pontuais: list[dict] = []
    if proposal is not None:
        services = (proposal.input_payload or {}).get("services") or []
        for svc in services:
            nome = str(svc.get("name") or "").strip()
            if not nome or not svc.get("active", True):
                continue
            if svc.get("type") in ("fixed", "pontual") or svc.get("is_pontual"):
                pontuais.append({"nome": nome, "descricao": "", "prazo": ""})
                continue
            quantidade = int(svc.get("monthly_quantity") or 1)
            frequencia = f"{quantidade}x/mês" if quantidade > 1 else "1x/mês"
            recorrentes.append(
                {"nome": nome, "descricao": "", "frequencia": frequencia, "prazo": ""}
            )
    if not recorrentes and not pontuais:
        recorrentes.append(
            {"nome": "", "descricao": "", "frequencia": "1x/mês", "prazo": ""}
        )
    return recorrentes, pontuais


def all_missing_field_descriptors(
    prospect: Prospect,
    proposal: PricingScenario | None,
    contractada: dict | None,
) -> list[dict[str, Any]]:
    """Descritores completos (escalares + listas) dos campos sem fonte no banco.

    Campos com valor pré-preenchido (default não vazio, perfil de CONTRATADA ou
    representante de CONTRATANTE no prospecto) não são solicitados no modal —
    o usuário ajusta o valor diretamente no contrato. Serviços e volumes do
    Anexo I vêm do orçamento e não são pedidos.
    """
    descriptors: list[dict[str, Any]] = []
    for group in SCALAR_FIELDS:
        for field in group["fields"]:
            source_key = CONTRATADA_SOURCE_KEYS.get(field["key"])
            if source_key and (contractada or {}).get(source_key):
                continue
            prospect_key = CONTRATANTE_SOURCE_KEYS.get(field["key"])
            if prospect_key and getattr(prospect, prospect_key, None):
                continue
            descriptor = dict(field)
            descriptor["group"] = group["group"]
            if "default_key" in descriptor:
                source = descriptor.pop("default_key")
                if source in ("cpf", "email"):
                    descriptor["default"] = _contractada_default(contractada, source)
                elif source == "hoje":
                    descriptor["default"] = datetime.now().date().isoformat()
                elif source == "data_inicio":
                    descriptor["default"] = (contractada or {}).get(
                        "data_inicio"
                    ) or datetime.now().date().isoformat()
                else:
                    descriptor["default"] = ""
            # Já preenchido por default (sessão Operação / Financeiro e prazo):
            # não perguntar — valor é resolvido na geração e pode ser editado.
            if descriptor.get("default"):
                continue
            descriptors.append(descriptor)
    descriptors.extend(describe_list_fields())

    # Achata entradas agrupadas {"group": ..., "field": {...}} em descritores
    # planos antes de retornar ao frontend.
    flat: list[dict[str, Any]] = []
    for item in descriptors:
        field = item.get("field")
        if isinstance(field, dict):
            descriptor = dict(field)
            descriptor["group"] = item.get("group", "")
            flat.append(descriptor)
        else:
            flat.append(item)
    return flat
