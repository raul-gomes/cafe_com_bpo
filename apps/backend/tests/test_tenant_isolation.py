"""Isolation between accounts for routines, SLAs and tasks (audit 2026-10-12).

Each test uses two accounts: A owns a company; B is an unrelated account that
knows A's ids. B must neither read nor change anything of A, and the answer
must be "not found" so it never confirms that the id exists.
"""

from uuid import UUID

from src.core.database import SessionLocal
from src.modules.task_manager.models import Task
from tests.helpers import paid_auth_header, unique_email
from tests.test_team_routines_e2e import get_raw_token_for_invite


def _company(client, auth: dict, name: str = "Empresa A") -> str:
    """Creates a client company and returns its id.

    Args:
        client: Test client.
        auth: Authorization header of the owner.
        name: Company name.

    Returns:
        The company id.
    """
    resp = client.post("/clients/", json={"name": name}, headers=auth)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


def _template(client, auth: dict) -> str:
    """Creates a monthly routine with one activity and returns its id.

    Args:
        client: Test client.
        auth: Authorization header of the owner.

    Returns:
        The template id.
    """
    resp = client.post(
        "/tasks/templates/",
        json={"name": "Fechamento", "recurrence": "monthly", "due_day": 10},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    template_id = resp.json()["id"]
    act = client.post(
        f"/tasks/templates/{template_id}/activities/",
        json={"name": "Conciliar"},
        headers=auth,
    )
    assert act.status_code == 201, act.text
    return template_id


def _two_accounts(client) -> tuple[dict, dict]:
    """Two independent accounts with full access.

    Args:
        client: Test client.

    Returns:
        Headers of the owner (A) and of the outsider (B).
    """
    return (
        paid_auth_header(client, unique_email("owner")),
        paid_auth_header(client, unique_email("outsider")),
    )


class TestRoutineLinks:
    """AUD-001: routine links (client-templates) are scoped to the company owner."""

    def test_outsider_cannot_link_own_routine_to_foreign_company(self, client):
        owner, outsider = _two_accounts(client)
        company_id = _company(client, owner)
        outsider_template = _template(client, outsider)

        resp = client.post(
            "/tasks/client-templates/",
            json={"client_id": company_id, "template_id": outsider_template},
            headers=outsider,
        )

        assert resp.status_code == 404, resp.text
        listed = client.get(
            f"/tasks/client-templates/?client_id={company_id}", headers=owner
        )
        assert listed.json() == []

    def test_outsider_cannot_list_foreign_links(self, client):
        owner, outsider = _two_accounts(client)
        company_id = _company(client, owner)
        template_id = _template(client, owner)
        client.post(
            "/tasks/client-templates/",
            json={"client_id": company_id, "template_id": template_id},
            headers=owner,
        )

        resp = client.get(
            f"/tasks/client-templates/?client_id={company_id}", headers=outsider
        )

        assert resp.status_code == 404, resp.text

    def test_outsider_cannot_change_remove_or_regenerate_foreign_link(self, client):
        owner, outsider = _two_accounts(client)
        company_id = _company(client, owner)
        template_id = _template(client, owner)
        link_id = client.post(
            "/tasks/client-templates/",
            json={"client_id": company_id, "template_id": template_id},
            headers=owner,
        ).json()["assignment_id"]

        disabled = client.patch(
            f"/tasks/client-templates/{link_id}",
            json={"is_active": False},
            headers=outsider,
        )
        regenerated = client.post(
            f"/tasks/client-templates/{link_id}/regenerate", headers=outsider
        )
        removed = client.delete(f"/tasks/client-templates/{link_id}", headers=outsider)

        assert (disabled.status_code, regenerated.status_code, removed.status_code) == (
            404,
            404,
            404,
        )
        links = client.get(
            f"/tasks/client-templates/?client_id={company_id}", headers=owner
        ).json()
        assert [(link["id"], link["is_active"]) for link in links] == [(link_id, True)]

    def test_owner_still_manages_own_links(self, client):
        owner, _ = _two_accounts(client)
        company_id = _company(client, owner)
        template_id = _template(client, owner)
        link_id = client.post(
            "/tasks/client-templates/",
            json={"client_id": company_id, "template_id": template_id},
            headers=owner,
        ).json()["assignment_id"]

        resp = client.patch(
            f"/tasks/client-templates/{link_id}",
            json={"is_active": False},
            headers=owner,
        )

        assert resp.status_code == 200, resp.text
        assert resp.json()["is_active"] is False

    def test_team_member_manages_only_own_links(self, client):
        """Team "Model A": a member links own routines, never changes the owner's."""
        owner, _ = _two_accounts(client)
        member_email = unique_email("member")
        member = paid_auth_header(client, member_email)
        company_id = _company(client, owner)
        owner_link = client.post(
            "/tasks/client-templates/",
            json={"client_id": company_id, "template_id": _template(client, owner)},
            headers=owner,
        ).json()["assignment_id"]
        invite = client.post(
            f"/clients/{company_id}/invite",
            json={"emails": [member_email], "template_ids": []},
            headers=owner,
        )
        assert invite.status_code == 201, invite.text
        token = get_raw_token_for_invite(company_id, member_email)
        accepted = client.get(f"/invitations/accept?token={token}", headers=member)
        assert accepted.status_code == 200, accepted.text

        member_link = client.post(
            "/tasks/client-templates/",
            json={"client_id": company_id, "template_id": _template(client, member)},
            headers=member,
        )
        on_owner_link = client.patch(
            f"/tasks/client-templates/{owner_link}",
            json={"is_active": False},
            headers=member,
        )
        on_own_link = client.patch(
            f"/tasks/client-templates/{member_link.json()['assignment_id']}",
            json={"is_active": False},
            headers=member,
        )

        assert member_link.status_code == 201, member_link.text
        assert on_owner_link.status_code == 404
        assert on_own_link.status_code == 200, on_own_link.text


class TestSLAs:
    """AUD-002: SLAs belong to the company owner."""

    def _sla(self, client, auth: dict, company_id: str) -> str:
        """Creates a 2-day SLA and returns its id.

        Args:
            client: Test client.
            auth: Authorization header of the owner.
            company_id: Company id.

        Returns:
            The SLA id.
        """
        resp = client.post(
            "/tasks/sla/",
            json={"client_id": company_id, "process_type": "fiscal", "sla_days": 2},
            headers=auth,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    def test_outsider_cannot_read_change_or_delete_foreign_sla(self, client):
        owner, outsider = _two_accounts(client)
        company_id = _company(client, owner)
        sla_id = self._sla(client, owner, company_id)

        listed = client.get(f"/tasks/sla/?client_id={company_id}", headers=outsider)
        changed = client.put(
            f"/tasks/sla/{sla_id}", json={"sla_days": 999}, headers=outsider
        )
        deleted = client.delete(f"/tasks/sla/{sla_id}", headers=outsider)

        assert (listed.status_code, changed.status_code, deleted.status_code) == (
            404,
            404,
            404,
        )
        kept = client.get(f"/tasks/sla/?client_id={company_id}", headers=owner).json()
        assert [(s["id"], s["sla_days"]) for s in kept] == [(sla_id, 2)]

    def test_outsider_cannot_create_sla_on_foreign_company(self, client):
        owner, outsider = _two_accounts(client)
        company_id = _company(client, owner)

        resp = client.post(
            "/tasks/sla/",
            json={"client_id": company_id, "process_type": "fiscal", "sla_days": 1},
            headers=outsider,
        )

        assert resp.status_code == 404, resp.text
        assert (
            client.get(f"/tasks/sla/?client_id={company_id}", headers=owner).json()
            == []
        )

    def test_owner_manages_own_sla(self, client):
        owner, _ = _two_accounts(client)
        company_id = _company(client, owner)
        sla_id = self._sla(client, owner, company_id)

        changed = client.put(
            f"/tasks/sla/{sla_id}", json={"sla_days": 5}, headers=owner
        )
        deleted = client.delete(f"/tasks/sla/{sla_id}", headers=owner)

        assert changed.status_code == 200 and changed.json()["sla_days"] == 5
        assert deleted.status_code == 204


class TestTaskCompany:
    """AUD-003: a task never moves to a company the caller cannot write on."""

    def _task(self, client, auth: dict, company_id: str) -> str:
        """Creates a loose task and returns its id.

        Args:
            client: Test client.
            auth: Authorization header of the owner.
            company_id: Company id.

        Returns:
            The task id.
        """
        resp = client.post(
            "/tasks/",
            json={"title": "Conciliar", "client_id": company_id},
            headers=auth,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["id"]

    def test_cannot_point_own_task_to_foreign_company(self, client):
        owner, outsider = _two_accounts(client)
        foreign_company = _company(client, owner, "Empresa A")
        own_company = _company(client, outsider, "Empresa B")
        task_id = self._task(client, outsider, own_company)

        resp = client.put(
            f"/tasks/{task_id}", json={"client_id": foreign_company}, headers=outsider
        )

        assert resp.status_code == 404, resp.text
        tasks = client.get(f"/tasks/?client_id={own_company}", headers=outsider).json()
        assert [t["id"] for t in tasks] == [task_id]

    def test_moving_between_own_companies_keeps_canonical_link(self, client):
        owner, _ = _two_accounts(client)
        first = _company(client, owner, "Primeira")
        second = _company(client, owner, "Segunda")
        task_id = self._task(client, owner, first)

        resp = client.put(
            f"/tasks/{task_id}", json={"client_id": second}, headers=owner
        )

        assert resp.status_code == 200, resp.text
        assert [
            t["id"]
            for t in client.get(f"/tasks/?client_id={second}", headers=owner).json()
        ] == [task_id]
        assert client.get(f"/tasks/?client_id={first}", headers=owner).json() == []
        session = SessionLocal()
        try:
            stored = session.get(Task, UUID(task_id))
            assert (str(stored.client_id), str(stored.company_id)) == (second, second)
        finally:
            session.close()

    def test_routine_card_does_not_change_company(self, client):
        owner, _ = _two_accounts(client)
        first = _company(client, owner, "Primeira")
        second = _company(client, owner, "Segunda")
        # A one-off routine generates its card right away, whatever the date.
        template_id = client.post(
            "/tasks/templates/",
            json={"name": "Abertura", "recurrence": "once", "due_days_from_start": 5},
            headers=owner,
        ).json()["id"]
        client.post(
            f"/tasks/templates/{template_id}/activities/",
            json={"name": "Cadastro inicial", "due_days": 5},
            headers=owner,
        )
        client.post(
            "/tasks/client-templates/",
            json={"client_id": first, "template_id": template_id},
            headers=owner,
        )
        cards = client.get(f"/tasks/?client_id={first}", headers=owner).json()
        routine_card = next(c for c in cards if c["template_id"] == template_id)

        resp = client.put(
            f"/tasks/{routine_card['id']}", json={"client_id": second}, headers=owner
        )

        assert resp.status_code == 409, resp.text
