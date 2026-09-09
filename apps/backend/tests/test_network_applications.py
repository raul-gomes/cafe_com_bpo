from uuid import uuid4


def auth_for(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Test User"}
    from tests.helpers import register_user

    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def get_uid(client, headers):
    me = client.get("/auth/me", headers=headers)
    return me.json()["id"]


def create_project(client, headers, title="Projeto Teste"):
    resp = client.post(
        "/network/projects",
        json={
            "title": title,
            "description": "Descrição detalhada do projeto",
            "skills": [],
            "team_size": 3,
            "remote_type": "remote",
        },
        headers=headers,
    )
    return resp.json()


# ── Aplicar para projeto ────────────────────────────────────


def test_apply_to_project(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    applicant_id = get_uid(client, applicant)

    resp = client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Tenho experiência com BPO financeiro, quero participar!"},
        headers=applicant,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "pending"
    assert data["project_id"] == project["id"]
    assert data["applicant"]["id"] == applicant_id
    assert data["message"] == "Tenho experiência com BPO financeiro, quero participar!"


def test_cannot_apply_to_own_project(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    resp = client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar do meu próprio projeto"},
        headers=owner,
    )
    assert resp.status_code == 400
    assert (
        "próprio" in resp.json()["detail"].lower()
        or "own" in resp.json()["detail"].lower()
    )


def test_cannot_apply_twice(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)

    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Primeira aplicação"},
        headers=applicant,
    )
    resp = client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Segunda aplicação"},
        headers=applicant,
    )
    assert resp.status_code == 400


def test_cannot_apply_to_closed_project(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    # Fechar o projeto
    client.patch(
        f"/network/projects/{project['id']}/status",
        headers=owner,
    )

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)

    resp = client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )
    assert resp.status_code == 400


# ── Listar candidaturas ─────────────────────────────────────


def test_owner_sees_applications(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    a1 = auth_for(client, f"aplic1_{uuid4()}@cafe.com")
    get_uid(client, a1)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Primeira aplicação"},
        headers=a1,
    )

    a2 = auth_for(client, f"aplic2_{uuid4()}@cafe.com")
    get_uid(client, a2)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Segunda aplicação"},
        headers=a2,
    )

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=owner,
    )
    assert resp.status_code == 200
    apps = resp.json()
    assert len(apps) == 2


def test_non_owner_cannot_see_applications(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    outsider = auth_for(client, f"outsider_{uuid4()}@cafe.com")
    get_uid(client, outsider)

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=outsider,
    )
    assert resp.status_code == 403


def test_my_applications(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Minha candidatura"},
        headers=applicant,
    )

    resp = client.get("/network/me/applications", headers=applicant)
    assert resp.status_code == 200
    apps = resp.json()
    assert len(apps) == 1
    assert apps[0]["project_id"] == project["id"]


# ── Aceitar / Recusar ───────────────────────────────────────


def test_accept_application(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=owner,
    )
    application_id = resp.json()[0]["id"]

    resp = client.post(
        f"/network/applications/{application_id}/accept",
        headers=owner,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "accepted"
    assert data["conversation_id"] is not None


def test_decline_application(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=owner,
    )
    application_id = resp.json()[0]["id"]

    resp = client.post(
        f"/network/applications/{application_id}/decline",
        headers=owner,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "declined"
    assert data["conversation_id"] is None


def test_non_owner_cannot_accept(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )

    outsider = auth_for(client, f"outsider_{uuid4()}@cafe.com")
    get_uid(client, outsider)

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=owner,
    )
    application_id = resp.json()[0]["id"]

    resp = client.post(
        f"/network/applications/{application_id}/accept",
        headers=outsider,
    )
    assert resp.status_code == 403


def test_accept_creates_conversation_and_group_access(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=owner,
    )
    application_id = resp.json()[0]["id"]

    resp = client.post(
        f"/network/applications/{application_id}/accept",
        headers=owner,
    )
    conv_id = resp.json()["conversation_id"]

    # Candidato agora é membro do grupo do projeto
    group_resp = client.get(
        f"/network/groups/{project['group_id']}",
        headers=applicant,
    )
    assert group_resp.status_code == 200
    assert group_resp.json()["is_member"] is True

    # Mensagem no chat
    chat_resp = client.get(
        f"/network/conversations/{conv_id}",
        headers=applicant,
    )
    assert chat_resp.status_code == 200
    msgs = chat_resp.json()["messages"]
    assert len(msgs) >= 1


def test_owner_receives_notification_on_apply(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )

    notifs = client.get("/notifications/", headers=owner).json()
    assert any(n["type"] == "project_application" for n in notifs)


def test_applicant_receives_notification_on_accept(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Quero participar"},
        headers=applicant,
    )

    resp = client.get(
        f"/network/projects/{project['id']}/applications",
        headers=owner,
    )
    application_id = resp.json()[0]["id"]

    client.post(
        f"/network/applications/{application_id}/accept",
        headers=owner,
    )

    notifs = client.get("/notifications/", headers=applicant).json()
    assert any(n["type"] == "application_accepted" for n in notifs)


# ── Fechar / Abrir projeto ──────────────────────────────────


def test_toggle_project_status(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    # Fechar
    resp = client.patch(
        f"/network/projects/{project['id']}/status",
        headers=owner,
    )
    assert resp.status_code == 200
    assert resp.json()["applications_closed"] is True

    # Abrir novamente
    resp = client.patch(
        f"/network/projects/{project['id']}/status",
        headers=owner,
    )
    assert resp.status_code == 200
    assert resp.json()["applications_closed"] is False


def test_non_owner_cannot_toggle_status(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    outsider = auth_for(client, f"outsider_{uuid4()}@cafe.com")
    get_uid(client, outsider)

    resp = client.patch(
        f"/network/projects/{project['id']}/status",
        headers=outsider,
    )
    assert resp.status_code == 403


def test_project_response_includes_application_count(client):
    owner = auth_for(client, f"owner_{uuid4()}@cafe.com")
    get_uid(client, owner)
    project = create_project(client, owner)

    applicant = auth_for(client, f"aplic_{uuid4()}@cafe.com")
    get_uid(client, applicant)
    client.post(
        f"/network/projects/{project['id']}/apply",
        json={"message": "Candidatura"},
        headers=applicant,
    )

    resp = client.get(f"/network/projects/{project['id']}", headers=owner)
    assert resp.json()["application_count"] == 1
    assert resp.json()["applications_closed"] is False
