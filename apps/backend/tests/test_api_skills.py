from uuid import uuid4

from tests.helpers import register_user


def get_auth_header(client, email):
    payload = {"email": email, "password": "StrongPassword123!", "name": "Skills User"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_update_biografia_via_profile(client):
    auth = get_auth_header(client, f"bio_{uuid4()}@cafe.com")
    resp = client.patch("/auth/me", json={"biografia": "BPO financeiro há 10 anos."}, headers=auth)
    assert resp.status_code == 200
    assert resp.json()["biografia"] == "BPO financeiro há 10 anos."

    me = client.get("/auth/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["biografia"] == "BPO financeiro há 10 anos."


def test_search_skills_by_query(client):
    auth = get_auth_header(client, f"search_{uuid4()}@cafe.com")

    client.post("/network/me/skills", json={"name": "React"}, headers=auth)
    client.post("/network/me/skills", json={"name": "React Native"}, headers=auth)
    client.post("/network/me/skills", json={"name": "Excel"}, headers=auth)

    resp = client.get("/network/skills?query=react&limit=10", headers=auth)
    assert resp.status_code == 200
    names = [s["name"] for s in resp.json()]
    assert "React" in names
    assert "React Native" in names
    assert "Excel" not in names

    resp = client.get("/network/skills?query=excel", headers=auth)
    names = [s["name"] for s in resp.json()]
    assert names == ["Excel"]


def test_add_skill_to_profile_success(client):
    auth = get_auth_header(client, f"add_{uuid4()}@cafe.com")
    resp = client.post("/network/me/skills", json={"name": "Contabilidade"}, headers=auth)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Contabilidade"
    assert "id" in data

    mine = client.get("/network/me/skills", headers=auth)
    assert mine.status_code == 200
    names = [s["name"] for s in mine.json()]
    assert names == ["Contabilidade"]


def test_add_skill_is_idempotent(client):
    auth = get_auth_header(client, f"idem_{uuid4()}@cafe.com")
    first = client.post("/network/me/skills", json={"name": "Excel"}, headers=auth)
    assert first.status_code == 201

    second = client.post("/network/me/skills", json={"name": "Excel"}, headers=auth)
    assert second.status_code in (200, 201)
    assert second.json()["id"] == first.json()["id"]

    mine = client.get("/network/me/skills", headers=auth)
    assert mine.status_code == 200
    assert len(mine.json()) == 1


def test_skill_name_is_reused_from_catalog(client):
    """Adicionar uma skill que já existe no catálogo não cria outra linha."""
    auth = get_auth_header(client, f"catalog_{uuid4()}@cafe.com")
    auth2 = get_auth_header(client, f"catalog2_{uuid4()}@cafe.com")

    first = client.post("/network/me/skills", json={"name": "React"}, headers=auth)
    assert first.status_code == 201

    second = client.post("/network/me/skills", json={"name": "React"}, headers=auth2)
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]

    # Catálogo não duplica
    search = client.get("/network/skills?query=react", headers=auth)
    assert len(search.json()) == 1


def test_remove_skill_from_profile(client):
    auth = get_auth_header(client, f"remove_{uuid4()}@cafe.com")
    added = client.post("/network/me/skills", json={"name": "Python"}, headers=auth)
    skill_id = added.json()["id"]

    resp = client.delete(f"/network/me/skills/{skill_id}", headers=auth)
    assert resp.status_code == 204

    mine = client.get("/network/me/skills", headers=auth)
    assert mine.json() == []


def test_create_skill_with_new_name_generates_slug(client):
    auth = get_auth_header(client, f"slug_{uuid4()}@cafe.com")
    resp = client.post(
        "/network/me/skills", json={"name": "Análise de Dados"}, headers=auth
    )
    assert resp.status_code == 201
    assert resp.json()["slug"] == "analise-de-dados"