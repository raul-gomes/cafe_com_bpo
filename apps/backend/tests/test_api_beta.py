"""
Beta signups (landing page during the beta phase).

POST /beta/signups is public (landing page acquisition): it validates the
data, requires LGPD consent, ignores bots (honeypot field) and does not reveal
whether the e-mail was already registered. GET /beta/signups lists the signups
for admins only, with exactly the fields the admin page renders.
"""

from uuid import uuid4

from src.core.database import SessionLocal
from src.modules.beta.models import BetaSignup
from tests.helpers import create_test_user


def _payload(**overrides) -> dict:
    """Builds a valid signup payload, with optional overrides.

    Args:
        **overrides: Fields to replace in the default payload.

    Returns:
        The payload dictionary.
    """
    data = {
        "name": "Ana Operadora",
        "email": f"beta_{uuid4().hex[:10]}@cafe.com",
        "whatsapp": "(11) 98765-4321",
        "profile": "growing",
        "client_range": "6-15",
        "challenge": "Quero parar de perder prazo no fechamento.",
        "lgpd_consent": True,
    }
    data.update(overrides)
    return data


def _rows(email: str) -> list[BetaSignup]:
    """Reads the stored signups of an e-mail straight from the database.

    Args:
        email: E-mail to look up.

    Returns:
        The matching rows.
    """
    session = SessionLocal()
    try:
        return session.query(BetaSignup).filter(BetaSignup.email == email).all()
    finally:
        session.close()


def _auth(client, role: str = "user") -> dict:
    """Creates a user with the given role and returns its auth header.

    Args:
        client: Test client.
        role: User role ("user" or "admin").

    Returns:
        The Authorization header.
    """
    email = f"beta_auth_{uuid4().hex[:8]}@cafe.com"
    create_test_user(email, role=role)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class TestBetaSignupCreate:
    def test_valid_signup_is_saved(self, client):
        payload = _payload()
        resp = client.post("/beta/signups", json=payload)
        assert resp.status_code == 201
        assert set(resp.json()) == {"message"}

        rows = _rows(payload["email"])
        assert len(rows) == 1
        row = rows[0]
        assert row.name == "Ana Operadora"
        assert row.whatsapp == "11987654321"  # digits only
        assert row.profile == "growing"
        assert row.client_range == "6-15"
        assert row.consented_at is not None

    def test_email_is_normalized_to_lowercase(self, client):
        email = f"Beta_{uuid4().hex[:8]}@Cafe.COM"
        resp = client.post("/beta/signups", json=_payload(email=email))
        assert resp.status_code == 201
        assert len(_rows(email.lower())) == 1

    def test_requires_lgpd_consent(self, client):
        payload = _payload(lgpd_consent=False)
        resp = client.post("/beta/signups", json=payload)
        assert resp.status_code == 422
        assert _rows(payload["email"]) == []

    def test_rejects_invalid_email(self, client):
        resp = client.post("/beta/signups", json=_payload(email="not-an-email"))
        assert resp.status_code == 422

    def test_rejects_unknown_profile(self, client):
        resp = client.post("/beta/signups", json=_payload(profile="hacker"))
        assert resp.status_code == 422

    def test_honeypot_filled_is_accepted_but_not_saved(self, client):
        """Bots fill the hidden field: same answer, nothing stored."""
        payload = _payload(website="http://spam.example")
        resp = client.post("/beta/signups", json=payload)
        assert resp.status_code == 201
        assert _rows(payload["email"]) == []

    def test_duplicate_email_updates_without_revealing(self, client):
        payload = _payload()
        first = client.post("/beta/signups", json=payload)
        second = client.post("/beta/signups", json={**payload, "client_range": "16-30"})
        assert first.status_code == second.status_code == 201
        assert first.json() == second.json()

        rows = _rows(payload["email"])
        assert len(rows) == 1
        assert rows[0].client_range == "16-30"

    def test_challenge_text_is_limited(self, client):
        resp = client.post("/beta/signups", json=_payload(challenge="x" * 1001))
        assert resp.status_code == 422


class TestBetaSignupList:
    def test_requires_auth(self, client):
        assert client.get("/beta/signups").status_code == 401

    def test_forbidden_for_non_admin(self, client):
        resp = client.get("/beta/signups", headers=_auth(client))
        assert resp.status_code == 403

    def test_admin_lists_signups_newest_first(self, client):
        older, newer = _payload(), _payload()
        client.post("/beta/signups", json=older)
        client.post("/beta/signups", json=newer)

        resp = client.get("/beta/signups", headers=_auth(client, role="admin"))
        assert resp.status_code == 200
        emails = [item["email"] for item in resp.json()]
        assert emails.index(newer["email"]) < emails.index(older["email"])

    def test_list_returns_only_the_fields_the_admin_page_reads(self, client):
        client.post("/beta/signups", json=_payload())
        resp = client.get("/beta/signups", headers=_auth(client, role="admin"))
        assert set(resp.json()[0]) == {
            "name",
            "email",
            "whatsapp",
            "profile",
            "client_range",
            "challenge",
            "signed_up_at",
        }
