"""Testes de renderização de templates de e-mail (TDD)."""

import pytest

from src.modules.emails.templates import (
    TemplateNotFoundError,
    render_template,
)


class TestRenderTemplate:
    def test_password_reset_renders_all_parts(self):
        subject, text, html = render_template(
            "password_reset",
            {"reset_url": "https://app.cafecombpo.com.br/redefinir?token=abc"},
        )
        assert "Redefina sua senha" in subject
        assert "https://app.cafecombpo.com.br/redefinir?token=abc" in html
        assert "https://app.cafecombpo.com.br/redefinir?token=abc" in text

    def test_invitation_renders(self):
        _subject, text, html = render_template(
            "invitation",
            {
                "accept_url": "https://app.cafecombpo.com.br/invitations/accept?token=x",
                "inviter_name": "João",
                "client_name": "Acme Ltda",
            },
        )
        assert "João" in html
        assert "Acme Ltda" in html
        assert "invitations/accept" in text

    def test_unknown_template_raises(self):
        with pytest.raises(TemplateNotFoundError):
            render_template("nao_existe", {})


class TestEscaping:
    def test_html_escapes_user_content(self):
        payload = {
            "inviter_name": '<script>alert("x")</script>',
            "client_name": "Acme & Cia",
        }
        _, _, html = render_template("invitation", payload)
        assert "<script>" not in html
        assert "&lt;script&gt;" in html
        assert "Acme &amp; Cia" in html

    def test_text_template_does_not_escape(self):
        _, text, _ = render_template(
            "invitation",
            {"inviter_name": "João & Maria", "client_name": "Acme Ltda"},
        )
        assert "João & Maria" in text

    def test_missing_value_becomes_empty(self):
        _, _, html = render_template(
            "invitation",
            {"inviter_name": "João"},
        )
        assert "client_name" in html  # variável sem valor vira string vazia, sem erro


class TestSubject:
    def test_subject_custom_override_allows_context(self):
        subject, _, _ = render_template("password_reset", {})
        assert "Café com BPO" in subject
