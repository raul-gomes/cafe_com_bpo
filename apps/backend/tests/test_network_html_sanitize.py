"""Trava da allowlist de HTML do fórum (SEC-1).

`network/repository.py` sanitiza post e comentário com bleach antes de gravar, e
o front renderiza esse HTML. A allowlist erazf → "o servidor limpa, então está
tudo bem": nenhum teste a travava, e uma tag nova liberada por engano (ou um
caminho de escrita que passasse pelo CRUD sem o `sanitize_html`) entraria em
produção sem o CI reclamar.

Estes testes existem para falhar quando a allowlist **crescer** sem revisão.
"""

import pytest

from src.modules.network.repository import (
    BLEACH_ALLOWED_PROTOCOLS,
    BLEACH_ALLOWED_TAGS,
    plain_text,
    sanitize_html,
)


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        ("<p>texto</p>", "<p>texto</p>"),
        ("<strong>forte</strong>", "<strong>forte</strong>"),
        ("<em>itálico</em>", "<em>itálico</em>"),
        ("<ul><li>item</li></ul>", "<ul><li>item</li></ul>"),
        ("<blockquote>citado</blockquote>", "<blockquote>citado</blockquote>"),
        ("<h3>titulo</h3>", "<h3>titulo</h3>"),
        ("<code>x = 1</code>", "<code>x = 1</code>"),
    ],
)
def test_allowed_formatting_survives(payload, expected):
    """A regra de negócio do fórum é texto rico: a formatação não pode sumir.

    A comparação é exata de propósito — se a bleach normalizar ou reordenar
    atributos, o teste avisa em vez de deixar passar.
    """
    assert sanitize_html(payload) == expected


def test_link_is_preserved():
    """Link http é conteúdo legítimo do fórum."""
    result = sanitize_html('<a href="https://cafe.com">site</a>')

    assert 'href="https://cafe.com"' in result


@pytest.mark.parametrize(
    "payload",
    [
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        "<iframe src='https://evil.example'></iframe>",
        "<svg onload=alert(1)></svg>",
        "<object data='x'></object>",
        "<embed src='x'>",
        "<form action='x'><input name='a'></form>",
        "<style>body{display:none}</style>",
        "<link rel=stylesheet href='x'>",
        "<meta http-equiv=refresh content='0;url=x'>",
        "<base href='https://evil.example'>",
    ],
)
def test_dangerous_markup_is_removed(payload):
    """Cada vetor clássico tem que sair inteiro, tag e atributo."""
    result = sanitize_html(payload)

    lowered = result.lower()
    for tag in ("script", "iframe", "svg", "object", "embed", "form", "style"):
        assert f"<{tag}" not in lowered, f"<{tag}> sobreviveu: {result}"
    assert "onerror" not in lowered
    assert "onload" not in lowered
    assert "javascript:" not in lowered


@pytest.mark.parametrize(
    "href",
    [
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "vbscript:msgbox(1)",
    ],
)
def test_dangerous_protocols_are_removed(href):
    """`href` é o atributo que executa: o protocolo tem que ser filtrado."""
    result = sanitize_html(f'<a href="{href}">clique</a>')

    assert "href" not in result.lower(), result
    assert "clique" in result, "o texto do link deve sobreviver"


def test_style_attribute_is_removed():
    """`style` é vetor de CSS injection (overlay, exfiltar por background)."""
    result = sanitize_html('<p style="position:fixed;inset:0">oi</p>')

    assert "style" not in result.lower()
    assert "oi" in result


def test_event_handler_attribute_is_removed():
    """`on*` não está na allowlist de atributos, então cai fora."""
    result = sanitize_html('<a href="https://cafe.com" onclick="alert(1)">x</a>')

    assert "onclick" not in result.lower()


def test_plain_text_strips_every_tag():
    """Notificações são texto simples e não podem carregar HTML."""
    result = plain_text("<p>ola <strong>mundo</strong></p><script>alert(1)</script>")

    assert "<" not in result
    assert "ola mundo" in result


def test_allowlist_only_grows_with_a_test():
    """Trava a lista: tag nova precisa de teste novo aqui.

    Se alguém adicionar `img` ou `table` à allowlist sem revisar, esta lista
    denuncia. Tags de formatação do fórum são as esperadas — nada executável.
    """
    assert BLEACH_ALLOWED_TAGS == {
        "p",
        "br",
        "b",
        "strong",
        "i",
        "em",
        "u",
        "s",
        "mark",
        "small",
        "sub",
        "sup",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "blockquote",
        "pre",
        "code",
        "ul",
        "ol",
        "li",
        "a",
        "span",
        "hr",
    }
    assert BLEACH_ALLOWED_PROTOCOLS == {"http", "https", "mailto"}
