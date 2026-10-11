"""
Inscrições de Betas (página inicial em fase beta).

POST /beta/inscricoes é público (captação na página inicial): valida dados,
exige aceite da LGPD, ignora robôs (campo-armadilha) e não revela se o e-mail
já estava inscrito. GET /beta/inscricoes lista as inscrições só para admin.
"""

from uuid import uuid4

from src.core.database import SessionLocal
from src.modules.beta.models import BetaSignup
from tests.helpers import create_test_user


def _payload(**overrides):
    data = {
        "nome": "Ana Operadora",
        "email": f"beta_{uuid4().hex[:10]}@cafe.com",
        "whatsapp": "(11) 98765-4321",
        "perfil": "crescendo",
        "faixa_clientes": "6-15",
        "desafio": "Quero parar de perder prazo no fechamento.",
        "consentimento_lgpd": True,
    }
    data.update(overrides)
    return data


def _rows(email: str) -> list[BetaSignup]:
    session = SessionLocal()
    try:
        return session.query(BetaSignup).filter(BetaSignup.email == email).all()
    finally:
        session.close()


def _auth(client, role: str = "user") -> dict:
    email = f"beta_auth_{uuid4().hex[:8]}@cafe.com"
    create_test_user(email, role=role)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class TestBetaSignupCreate:
    def test_valid_signup_is_saved(self, client):
        payload = _payload()
        resp = client.post("/beta/inscricoes", json=payload)
        assert resp.status_code == 201
        assert "id" not in resp.json()

        rows = _rows(payload["email"])
        assert len(rows) == 1
        row = rows[0]
        assert row.nome == "Ana Operadora"
        assert row.whatsapp == "11987654321"  # só dígitos
        assert row.perfil == "crescendo"
        assert row.faixa_clientes == "6-15"
        assert row.consentimento_em is not None

    def test_email_is_normalized_to_lowercase(self, client):
        email = f"Beta_{uuid4().hex[:8]}@Cafe.COM"
        resp = client.post("/beta/inscricoes", json=_payload(email=email))
        assert resp.status_code == 201
        assert len(_rows(email.lower())) == 1

    def test_requires_lgpd_consent(self, client):
        payload = _payload(consentimento_lgpd=False)
        resp = client.post("/beta/inscricoes", json=payload)
        assert resp.status_code == 422
        assert _rows(payload["email"]) == []

    def test_rejects_invalid_email(self, client):
        resp = client.post("/beta/inscricoes", json=_payload(email="nao-e-email"))
        assert resp.status_code == 422

    def test_rejects_unknown_profile(self, client):
        resp = client.post("/beta/inscricoes", json=_payload(perfil="hacker"))
        assert resp.status_code == 422

    def test_honeypot_filled_is_accepted_but_not_saved(self, client):
        """Robôs preenchem o campo escondido: resposta igual, nada gravado."""
        payload = _payload(website="http://spam.example")
        resp = client.post("/beta/inscricoes", json=payload)
        assert resp.status_code == 201
        assert _rows(payload["email"]) == []

    def test_duplicate_email_updates_without_revealing(self, client):
        payload = _payload()
        first = client.post("/beta/inscricoes", json=payload)
        second = client.post(
            "/beta/inscricoes", json={**payload, "faixa_clientes": "16-30"}
        )
        assert first.status_code == second.status_code == 201
        assert first.json() == second.json()

        rows = _rows(payload["email"])
        assert len(rows) == 1
        assert rows[0].faixa_clientes == "16-30"

    def test_challenge_text_is_limited(self, client):
        resp = client.post("/beta/inscricoes", json=_payload(desafio="x" * 1001))
        assert resp.status_code == 422


class TestBetaSignupList:
    def test_requires_auth(self, client):
        assert client.get("/beta/inscricoes").status_code == 401

    def test_forbidden_for_non_admin(self, client):
        resp = client.get("/beta/inscricoes", headers=_auth(client))
        assert resp.status_code == 403

    def test_admin_lists_signups_newest_first(self, client):
        older, newer = _payload(), _payload()
        client.post("/beta/inscricoes", json=older)
        client.post("/beta/inscricoes", json=newer)

        resp = client.get("/beta/inscricoes", headers=_auth(client, role="admin"))
        assert resp.status_code == 200
        emails = [item["email"] for item in resp.json()]
        assert emails.index(newer["email"]) < emails.index(older["email"])
        item = next(i for i in resp.json() if i["email"] == newer["email"])
        assert item["perfil"] == "crescendo"
        assert "criado_em" in item
