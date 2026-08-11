"""Renderização de templates de e-mail com escape automático de variáveis."""

import html
import os
from string import Template
from typing import Any

# Mapeia cada template para (arquivo_html, arquivo_txt, assunto)
TEMPLATES: dict[str, dict[str, str]] = {
    "password_reset": {
        "html": "password_reset.html",
        "txt": "password_reset.txt",
        "subject": "Redefina sua senha – Café com BPO",
    },
    "invitation": {
        "html": "invitation.html",
        "txt": "invitation.txt",
        "subject": "Você foi convidado para uma equipe no Café com BPO",
    },
    "notification": {
        "html": "notification.html",
        "txt": "notification.txt",
        "subject": "Atualização importante na sua conta",
    },
    "proposal": {
        "html": "proposal.html",
        "txt": "proposal.txt",
        "subject": "Orçamento Café com BPO",
    },
    "task_delivery": {
        "html": "task_delivery.html",
        "txt": "task_delivery.txt",
        "subject": "Entrega de documento",
    },
    "custom": {
        "subject": "",  # assunto vem do payload em render_template
    },
}

_TEMPLATE_DIR = os.path.dirname(os.path.abspath(__file__))


class TemplateNotFoundError(ValueError):
    pass


def _load(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def _render_body(path: str, payload: dict[str, Any], escape_html: bool) -> str:
    """Renderiza o corpo do template substituindo $var pelo valor do payload.

    Em HTML, escapa todos os valores antes da substituição.
    """
    tpl = _load(path)
    params: dict[str, Any] = {}
    for key, value in payload.items():
        if value is None:
            value = ""
        params[key] = html.escape(str(value)) if escape_html else str(value)
    return Template(tpl).safe_substitute(params)


def render_template(
    template_name: str,
    payload: dict[str, Any],
) -> tuple[str, str, str]:
    """Retorna (subject, text, html) para o template informado.

    Levanta TemplateNotFoundError quando o template não existe.
    """
    if template_name == "custom":
        # Conteúdo livre passado diretamente pelo chamador
        return (
            str(payload.get("subject", "")),
            str(payload.get("text", "")),
            str(payload.get("html", "")),
        )

    if template_name not in TEMPLATES:
        raise TemplateNotFoundError(f"Template de e-mail desconhecido: {template_name}")

    entry = TEMPLATES[template_name]
    subject = entry["subject"]
    html_body = _render_body(
        os.path.join(_TEMPLATE_DIR, entry["html"]),
        payload,
        escape_html=True,
    )
    text_body = _render_body(
        os.path.join(_TEMPLATE_DIR, entry["txt"]),
        payload,
        escape_html=False,
    )
    return subject, text_body, html_body
