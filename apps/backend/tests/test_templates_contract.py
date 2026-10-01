"""Template payload contract: a field exists only if a page renders it.

Phase 5 of the read-to-render plan. Every response of the template endpoints is
a hand-written DTO, so each assertion below pins the exact key set. Fields that
no page or hook reads must not ship: they leak internal columns, force the
frontend type to carry dead weight and invite the next screen to depend on
them.

`docs/tree_files.md` and AGENTS.md §6 are the rule; the frontend reads tracked
down here:

- `TemplateListPage` / `TemplateDetailPage` / `RoutineDrawer` render the name,
  description, process type, recurrence and its configuration (weekday mask,
  due day/month/days-from-start), the active/general/archived flags, the routine
  type triple, the owner and the nested activities.
- `OverdueTemplatesAlert` renders only the id, name, recurrence, activity count
  and days overdue.
- `EmpresasPage` renders only the assignment id, its template/client ids and the
  active flag.
"""

from uuid import uuid4

from fastapi import status

from tests.helpers import create_test_user

PASSWORD = "StrongPassword123!"

TEMPLATE_KEYS = {
    "id",
    "user_id",
    "name",
    "description",
    "process_type",
    "recurrence",
    "weekday_mask",
    "due_day",
    "due_month",
    "due_days_from_start",
    "is_active",
    "is_general",
    "is_archived",
    "routine_type_id",
    "routine_type_name",
    "routine_type_color",
}

LIST_ITEM_KEYS = TEMPLATE_KEYS | {"is_overdue", "days_overdue", "activity_count"}

ACTIVITY_KEYS = {
    "id",
    "name",
    "description",
    "priority",
    "due_day",
    "due_days",
    "estimated_minutes",
    "order",
}

OVERDUE_KEYS = {"id", "name", "recurrence", "days_overdue", "activity_count"}

ASSIGNMENT_KEYS = {"id", "client_id", "template_id", "is_active"}


def _auth(client, email: str) -> dict:
    """Registers a user and returns its authorization header.

    Args:
        client: The FastAPI test client.
        email: Email to register and log in with.

    Returns:
        The Authorization header of the new user.
    """
    create_test_user(email=email.lower(), password=PASSWORD, name="Contract User")
    response = client.post(
        "/auth/login", data={"username": email.lower(), "password": PASSWORD}
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _template(client, auth: dict, **over) -> dict:
    """Creates a monthly template and returns the created payload.

    Args:
        client: The FastAPI test client.
        auth: Authorization header of the owner.
        **over: Fields overriding the default template payload.

    Returns:
        The created template payload.
    """
    payload = {"name": f"Contract {uuid4()}", "recurrence": "monthly", "due_day": 10}
    payload.update(over)
    response = client.post("/tasks/templates/", json=payload, headers=auth)
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return response.json()


def _company(client, auth: dict) -> str:
    """Creates a company and returns its id.

    Args:
        client: The FastAPI test client.
        auth: Authorization header of the owner.

    Returns:
        The id of the created company.
    """
    response = client.post(
        "/clients/", json={"name": f"Empresa {uuid4()}"}, headers=auth
    )
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return response.json()["id"]


def test_the_template_list_ships_only_what_the_list_page_renders(client):
    """GET /tasks/templates/ returns the list item DTO and nothing else."""
    auth = _auth(client, f"tpl_list_{uuid4()}@cafe.com")
    _template(client, auth)

    response = client.get("/tasks/templates/", headers=auth)

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()[0]) == LIST_ITEM_KEYS


def test_the_template_detail_drops_the_columns_no_screen_uses(client):
    """GET /tasks/templates/{id} trims the audit and internal columns."""
    auth = _auth(client, f"tpl_detail_{uuid4()}@cafe.com")
    template_id = _template(client, auth)["id"]

    response = client.get(f"/tasks/templates/{template_id}", headers=auth)

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()) == TEMPLATE_KEYS | {"activities"}


def test_the_nested_activities_ship_what_the_task_deadline_is_built_from(client):
    """The activities keep the schedule the scheduler reads to set a deadline.

    The activity list does not render them, but `due_day`/`due_days` are what
    `scheduler.calculate_activity_deadline` uses, and the client commands that
    create the routine send them. Dropping them from the contract would be a
    payload/side-effect mismatch, so the contract test pins them instead.
    """
    auth = _auth(client, f"tpl_acts_{uuid4()}@cafe.com")
    template_id = _template(client, auth)["id"]
    created = client.post(
        f"/tasks/templates/{template_id}/activities/",
        json={"name": "Conferir planilha", "estimated_minutes": 30},
        headers=auth,
    )
    assert created.status_code == status.HTTP_201_CREATED, created.text

    response = client.get(f"/tasks/templates/{template_id}", headers=auth)

    assert set(created.json()) == ACTIVITY_KEYS
    assert set(response.json()["activities"][0]) == ACTIVITY_KEYS


def test_the_overdue_alert_ships_only_what_the_alert_renders(client):
    """GET /tasks/templates/overdue/ returns the five fields of the alert."""
    auth = _auth(client, f"tpl_overdue_{uuid4()}@cafe.com")
    # The overdue rule is `due_date` (or the recurrence end) in the past, so the
    # fixture is a template whose fixed date has already gone by.
    _template(
        client,
        auth,
        recurrence="once",
        due_date="2020-01-01T00:00:00",
    )

    response = client.get("/tasks/templates/overdue/", headers=auth)

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()[0]) == OVERDUE_KEYS


def test_the_assignment_list_ships_only_what_the_company_page_renders(client):
    """GET /tasks/client-templates/ drops the owner and the audit columns."""
    auth = _auth(client, f"tpl_owner_{uuid4()}@cafe.com")
    client_id = _company(client, auth)
    template_id = _template(client, auth)["id"]
    created = client.post(
        "/tasks/client-templates/",
        json={"client_id": str(client_id), "template_id": template_id},
        headers=auth,
    )
    assert created.status_code == status.HTTP_201_CREATED, created.text

    response = client.get(
        "/tasks/client-templates/", params={"client_id": str(client_id)}, headers=auth
    )

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()[0]) == ASSIGNMENT_KEYS


def test_creating_an_assignment_returns_a_typed_payload(client):
    """POST /tasks/client-templates/ answers a DTO, not a bare dict."""
    auth = _auth(client, f"tpl_create_{uuid4()}@cafe.com")
    template_id = _template(client, auth)["id"]
    client_id = _company(client, auth)

    response = client.post(
        "/tasks/client-templates/",
        json={"client_id": str(client_id), "template_id": template_id},
        headers=auth,
    )

    assert response.status_code == status.HTTP_201_CREATED, response.text
    assert set(response.json()) == {"assignment_id", "tasks_generated"}


def test_regenerating_returns_a_typed_payload(client):
    """POST /tasks/client-templates/{id}/regenerate answers a DTO."""
    auth = _auth(client, f"tpl_regen_{uuid4()}@cafe.com")
    template_id = _template(client, auth)["id"]
    client_id = _company(client, auth)
    assignment_id = client.post(
        "/tasks/client-templates/",
        json={"client_id": str(client_id), "template_id": template_id},
        headers=auth,
    ).json()["assignment_id"]

    response = client.post(
        f"/tasks/client-templates/{assignment_id}/regenerate", headers=auth
    )

    assert response.status_code == status.HTTP_200_OK, response.text
    assert set(response.json()) == {"tasks_generated"}
