"""
Test: ao desvincular uma rotina do cliente (DELETE client-template):

- Cards NÃO concluídos (a fazer e em andamento) somem junto.
- Cards CONCLUÍDOS são preservados.
- A equipe e os colaboradores perdem o acesso à rotina desvinculada
  (invitation_routines do template são removidos).
"""

from uuid import UUID, uuid4

from fastapi.testclient import TestClient


def get_auth_header(client, email, name="Membro"):
    payload = {"email": email, "password": "StrongPassword123!", "name": name}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_client(client, auth, name="Empresa Unlink"):
    resp = client.post(
        "/clients/", json={"name": name, "cnpj": "12.345.678/0001-99"}, headers=auth
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_template(client, auth, name):
    resp = client.post(
        "/tasks/templates/",
        json={"name": name, "process_type": "fiscal", "recurrence": "once"},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def create_activity(client, auth, template_id, name):
    resp = client.post(
        f"/tasks/templates/{template_id}/activities/",
        json={"name": name, "due_days": 5, "estimated_minutes": 30},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def assign_template(client, auth, client_id, template_id):
    resp = client.post(
        "/tasks/client-templates/",
        json={"client_id": client_id, "template_id": template_id},
        headers=auth,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def get_done_phase(client, auth):
    phases = client.get("/tasks/phases/", headers=auth).json()
    done = next((p for p in phases if p["is_done"]), None)
    if not done:
        done = max(phases, key=lambda p: p["order"])
    return done["id"]


class TestUnlinkRevokesRoutine:
    def test_unlink_removes_incomplete_keeps_completed(self, client: TestClient):
        """Desvincular apaga a fazer/em andamento e preserva os concluídos."""
        suf = uuid4().hex[:8]
        owner_auth = get_auth_header(
            client, f"unlink_owner_{suf}@cafe.com", name="Owner Unlink"
        )
        cli = create_client(client, owner_auth, name=f"Unlink {suf}")

        tmpl = create_template(client, owner_auth, "Rotina Unlink")
        create_activity(client, owner_auth, tmpl["id"], "Atividade A")
        create_activity(client, owner_auth, tmpl["id"], "Atividade B")

        assign = assign_template(client, owner_auth, cli["id"], tmpl["id"])
        assign_id = assign["assignment_id"]
        assert assign["tasks_generated"] == 2, (
            f"once deve gerar 1 task por atividade, got {assign['tasks_generated']}"
        )

        tasks = client.get(f"/tasks/?client_id={cli['id']}", headers=owner_auth).json()
        assert len(tasks) == 2

        # Move uma task para "concluido" (phase done) → completed_at setado
        done_phase = get_done_phase(client, owner_auth)
        completed_task_id = tasks[0]["id"]
        move = client.put(
            f"/tasks/{completed_task_id}",
            json={"phase_id": done_phase},
            headers=owner_auth,
        )
        assert move.status_code == 200, move.text
        assert move.json()["completed_at"] is not None

        # Desvincula a rotina
        unlink = client.delete(
            f"/tasks/client-templates/{assign_id}", headers=owner_auth
        )
        assert unlink.status_code == 204, unlink.text

        # Sobra apenas o card concluído; o incompleto sumiu
        remaining = client.get(
            f"/tasks/?client_id={cli['id']}", headers=owner_auth
        ).json()
        assert len(remaining) == 1, (
            f"Esperado 1 card restante (concluído), got {len(remaining)}"
        )
        assert remaining[0]["id"] == completed_task_id
        assert remaining[0]["completed_at"] is not None

    def test_unlink_revokes_member_routine_access(self, client: TestClient):
        """Desvincular revoga o acesso da rotina para a equipe/colaboradores."""
        suf = uuid4().hex[:8]
        owner_auth = get_auth_header(
            client, f"rev_owner_{suf}@cafe.com", name="Owner Rev"
        )
        member_auth = get_auth_header(
            client, f"rev_member_{suf}@cafe.com", name="Membro Rev"
        )
        member_email = f"rev_member_{suf}@cafe.com"
        cli = create_client(client, owner_auth, name=f"Rev {suf}")

        tmpl = create_template(client, owner_auth, "Rotina Revogar")
        create_activity(client, owner_auth, tmpl["id"], "Atividade Rev")
        assign = assign_template(client, owner_auth, cli["id"], tmpl["id"])
        assign_id = assign["assignment_id"]

        # Owner convida membro liberando a rotina e membro aceita
        inv = client.post(
            f"/clients/{cli['id']}/invite",
            json={"emails": [member_email], "template_ids": [tmpl["id"]]},
            headers=owner_auth,
        )
        assert inv.status_code == 201, inv.text

        from src.core.database import SessionLocal
        from src.modules.team.repository import TeamRepository

        session = SessionLocal()
        try:
            repo = TeamRepository(session)
            team = repo.get_team_by_client_id(UUID(cli["id"]))
            pending = repo.get_pending_invitation_by_email(team.id, member_email)
            assert pending is not None
            _, raw = repo.create_invitation(
                team_id=UUID(str(team.id)),
                invited_by=UUID(str(pending.invited_by)),
                invited_email=member_email,
                template_ids=[UUID(tmpl["id"])],
            )
        finally:
            session.close()

        acc = client.get(f"/invitations/accept?token={raw}", headers=member_auth)
        assert acc.status_code == 200, acc.text
        assert acc.json()["status"] == "accepted"

        team = client.get(f"/clients/{cli['id']}/team", headers=owner_auth).json()
        member = next(m for m in team["members"] if m["email"] == member_email)
        assert any(r["template_id"] == tmpl["id"] for r in member["routines"]), (
            "Membro deveria ter a rotina antes do unlink"
        )

        # Desvincula a rotina do cliente
        unlink = client.delete(
            f"/tasks/client-templates/{assign_id}", headers=owner_auth
        )
        assert unlink.status_code == 204, unlink.text

        # Membro perde o acesso à rotina
        team_after = client.get(f"/clients/{cli['id']}/team", headers=owner_auth).json()
        member_after = next(
            m for m in team_after["members"] if m["email"] == member_email
        )
        assert not any(
            r["template_id"] == tmpl["id"] for r in member_after["routines"]
        ), "Membro não deveria mais ter acesso à rotina desvinculada"
