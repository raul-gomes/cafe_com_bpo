"""Contract of `GET /access`.

The frontend asks this endpoint once and decides locks, banners and the
subscription call to action from the answer. That is why the module list is
returned instead of being re-declared in the UI: two copies of the gate map drift
within a release.

The payload is also a contract, so the test asserts its exact keys. A field that
nothing renders does not ship (§6 of the working agreements): `created_at`,
`user_id`, the Asaas ids and the whole subscription row are internal.
"""

from uuid import uuid4

from tests.helpers import create_test_user

EXPECTED_KEYS = {
    "access",
    "read_only_modules",
    "writable_modules",
    "expires_at",
    "grace_until",
    "shows_dunning_banner",
    "shows_beta_banner",
    "subscription_status",
    "plan",
    "is_admin",
}


def _register(client, role: str = "user") -> dict:
    """Registers a user and returns its authorization header.

    Args:
        client: FastAPI test client.
        role: `user` or `admin`.

    Returns:
        The `Authorization` header of the new session.
    """
    email = f"acc_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role=role)
    token = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert token.status_code == 200, token.text
    return {"Authorization": f"Bearer {token.json()['access_token']}"}


def test_access_requires_authentication(client):
    """The endpoint describes the caller; an anonymous caller has no answer."""
    assert client.get("/access").status_code == 401


def test_free_user_payload(client):
    """A user with nothing gets the free answer, spelled out.

    Args:
        client: FastAPI test client.
    """
    response = client.get("/access", headers=_register(client))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["access"] == "free"
    assert sorted(body["read_only_modules"]) == ["captar", "gestao"]
    assert sorted(body["writable_modules"]) == [
        "comunidade",
        "operacional",
        "pagamentos",
    ]
    assert body["expires_at"] is None
    assert body["grace_until"] is None
    assert body["shows_dunning_banner"] is False
    assert body["shows_beta_banner"] is False
    assert body["subscription_status"] is None
    assert body["plan"] is None
    assert body["is_admin"] is False


def test_payload_carries_exactly_the_agreed_keys(client):
    """Nothing extra travels: an internal column must not become public.

    Args:
        client: FastAPI test client.
    """
    body = client.get("/access", headers=_register(client)).json()

    assert set(body) == EXPECTED_KEYS


def test_admin_sees_no_locked_module(client):
    """D11: an admin is never locked out.

    Args:
        client: FastAPI test client.
    """
    body = client.get("/access", headers=_register(client, role="admin")).json()

    assert body["access"] == "admin"
    assert body["read_only_modules"] == []
    assert body["is_admin"] is True


def test_beta_user_near_the_end_sees_the_banner(client):
    """D12: inside the window `GET /access` raises the panel banner flag.

    Args:
        client: FastAPI test client.
    """
    from datetime import UTC, datetime, timedelta

    from src.core.database import SessionLocal
    from src.modules.auth.models import User
    from src.modules.subscriptions.models import BetaAccess

    email = f"acc_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")
    with SessionLocal() as session:
        user = session.query(User).filter_by(email=email).one()
        session.add(
            BetaAccess(
                id=uuid4(),
                user_id=user.id,
                expires_at=datetime.now(UTC) + timedelta(days=10),
                source="launch_beta",
            )
        )
        session.commit()

    token = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert token.status_code == 200, token.text
    body = client.get(
        "/access",
        headers={"Authorization": f"Bearer {token.json()['access_token']}"},
    ).json()

    assert body["access"] == "beta"
    assert body["shows_beta_banner"] is True
