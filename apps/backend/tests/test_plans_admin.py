"""Admin CRUD of the plan catalog — the Config screen's only write path.

`plans.price` is the **source of truth for the price** (§17.1): no subscription
ever receives an amount from the browser, so this screen is the only place the
price changes. Three things are protected here:

1. **Authorization.** §17.1 says the price is editable only by `role = admin`,
   and the check lives in the service, not only in the router, so no other caller
   reaches the write.
2. **`code` and `cycle` are immutable.** The code is the business key (it is what
   a subscription points at through `subscriptions.plan_id`, which is
   `ON DELETE RESTRICT`). Renaming it would silently repoint history.
3. **No delete.** A plan referenced by a subscription cannot go away, and one
   that is not referenced would still be shown to the checkout as sellable.
   Deactivation (`is_active = false`) is the whole lifecycle: non-admins stop
   seeing the plan, existing subscribers keep it.

The payload is a contract, so the exact keys are asserted: `created_at` and
`updated_at` are internal columns (§6) and do not ship.
"""

from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from src.core.database import SessionLocal
from src.modules.auth.models import User
from src.modules.auth.schemas import UserResponse
from src.modules.subscriptions.models import Plan
from src.modules.subscriptions.schemas import PlanUpdate
from src.modules.subscriptions.service import PlanService
from tests.helpers import create_test_user

EXPECTED_KEYS = {
    "id",
    "code",
    "name",
    "price",
    "cycle",
    "is_active",
    "description",
    "subscriber_count",
}


@pytest.fixture
def plan(db_session: Session) -> Plan:
    """Seeds the monthly plan, as the launch migration does.

    Args:
        db_session: Database session.

    Returns:
        The seeded plan.
    """
    row = Plan(
        code="monthly",
        name="Mensal",
        price=Decimal("27.90"),
        cycle="MONTHLY",
        description="Acesso completo, cobrado todo mês",
        is_active=True,
    )
    db_session.add(row)
    db_session.commit()
    return row


def _headers(client, role: str = "admin") -> dict:
    """Registers a user and returns its authorization header.

    Args:
        client: FastAPI test client.
        role: `user` or `admin`.

    Returns:
        The `Authorization` header of the new session.
    """
    email = f"plan_{role}_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role=role)
    token = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert token.status_code == 200, token.text
    return {"Authorization": f"Bearer {token.json()['access_token']}"}


def test_list_requires_authentication(client):
    """The catalog is behind the login: an anonymous caller has no answer."""
    assert client.get("/plans").status_code == 401


def test_admin_reads_the_catalog(client, plan: Plan):
    """The screen opens with what is in the database, price included.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.get("/plans", headers=_headers(client))

    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["code"] == "monthly"
    assert body[0]["price"] == "27.90"
    assert body[0]["subscriber_count"] == 0


def test_payload_carries_exactly_the_agreed_keys(client, plan: Plan):
    """Nothing extra travels: an internal column must not become public.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    body = client.get("/plans", headers=_headers(client)).json()

    assert set(body[0]) == EXPECTED_KEYS


def test_inactive_plan_is_hidden_from_non_admins(client, plan: Plan):
    """A deactivated plan is out of the catalog for everyone but the admin.

    The checkout (Fase 4) reads this same endpoint, so a plan the admin archived
    must not be offered to a paying user.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    client.patch(
        f"/plans/{plan.id}",
        json={"is_active": False},
        headers=_headers(client),
    )

    assert client.get("/plans", headers=_headers(client, role="user")).json() == []
    assert len(client.get("/plans", headers=_headers(client)).json()) == 1


def test_admin_creates_a_plan(client, plan: Plan):
    """Creating is how a second price becomes sellable.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.post(
        "/plans",
        json={
            "code": "monthly_pro",
            "name": "Mensal Pro",
            "price": "49.90",
            "cycle": "MONTHLY",
            "description": "Mesmo acesso, com suporte prioritário",
        },
        headers=_headers(client),
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["code"] == "monthly_pro"
    assert body["price"] == "49.90"
    assert body["is_active"] is True


def test_duplicate_code_is_refused(client, plan: Plan):
    """The code is unique: two plans with the same key make history ambiguous.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.post(
        "/plans",
        json={"code": "monthly", "name": "Outro", "price": "10.00", "cycle": "MONTHLY"},
        headers=_headers(client),
    )

    assert response.status_code == 409, response.text


def test_unknown_cycle_is_refused(client, plan: Plan):
    """Only the cycles the billing client knows are accepted.

    A cycle Asaas does not bill would create a plan nobody can be charged for.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.post(
        "/plans",
        json={
            "code": "weird",
            "name": "Estranho",
            "price": "10.00",
            "cycle": "FORTNIGHT",
        },
        headers=_headers(client),
    )

    assert response.status_code == 422, response.text


@pytest.mark.parametrize("cycle", ["YEARLY", "WEEKLY", "QUARTERLY"])
def test_only_the_monthly_cycle_is_sold(client, plan: Plan, cycle: str):
    """AUD-009 (owner decision 2026-10-12): plans differ by features, never by
    cycle. A cycle Asaas bills but the product does not sell would charge one
    cycle and grant one month.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
        cycle: A non-monthly cycle Asaas accepts.
    """
    response = client.post(
        "/plans",
        json={
            "code": f"plan_{cycle.lower()}",
            "name": "Outro",
            "price": "10.00",
            "cycle": cycle,
        },
        headers=_headers(client),
    )

    assert response.status_code == 422, response.text


def test_admin_updates_the_price(client, plan: Plan):
    """The price changes here and nowhere else.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.patch(
        f"/plans/{plan.id}",
        json={"price": "31.90", "name": "Mensal Promo"},
        headers=_headers(client),
    )

    assert response.status_code == 200, response.text
    assert response.json()["price"] == "31.90"
    assert response.json()["name"] == "Mensal Promo"


def test_code_and_cycle_cannot_be_changed(client, plan: Plan):
    """The business key is frozen: a rename would repoint paid history.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.patch(
        f"/plans/{plan.id}",
        json={"code": "monthly_v2", "cycle": "YEARLY"},
        headers=_headers(client),
    )

    assert response.status_code == 422, response.text


def test_unknown_plan_is_not_found(client, plan: Plan):
    """Editing a plan that does not exist is a 404, not a silent no-op.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    response = client.patch(
        f"/plans/{uuid4()}", json={"price": "1.00"}, headers=_headers(client)
    )

    assert response.status_code == 404, response.text


def test_non_admin_cannot_write(client, plan: Plan):
    """§17.1: the price is an admin's edit. A user gets 403, not a hidden button.

    Args:
        client: FastAPI test client.
        plan: Seeded plan.
    """
    headers = _headers(client, role="user")

    created = client.post(
        "/plans",
        json={"code": "sneaky", "name": "Sneaky", "price": "0.01", "cycle": "MONTHLY"},
        headers=headers,
    )
    edited = client.patch(f"/plans/{plan.id}", json={"price": "0.01"}, headers=headers)

    assert created.status_code == 403, created.text
    assert edited.status_code == 403, edited.text


def test_service_refuses_a_non_admin_even_without_the_router(
    db_session: Session, plan: Plan
):
    """The authorization check belongs to the service, not to the route.

    Calling the service directly — the way a future checkout, a script or a job
    would — must not be a way around §17.1.

    Args:
        db_session: Database session.
        plan: Seeded plan.
    """
    email = f"direct_{uuid4().hex}@cafe.com"
    create_test_user(email=email, role="user")
    # The same object `get_current_user` hands to the routers. The helper closes
    # its own session, so the actor is re-read by e-mail instead of reused.
    with SessionLocal() as session:
        actor = UserResponse.from_user(
            session.query(User).filter(User.email == email).one()
        )

    with pytest.raises(HTTPException) as denied:
        PlanService(db_session).update_plan(
            actor=actor, plan_id=plan.id, data=PlanUpdate(price=Decimal("0.01"))
        )

    assert denied.value.status_code == 403
