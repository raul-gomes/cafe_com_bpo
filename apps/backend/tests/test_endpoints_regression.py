"""
Regression Test Suite — Café com BPO
=====================================
Testa TODOS os endpoints da aplicação para garantir que:
- Endpoints públicos e protegidos respondem corretamente
- Payloads corretos são aceitos (201/200)
- Payloads incorretos são rejeitados (422)
- Autenticação é exigida onde necessário (401)
- Recursos inexistentes retornam 404
- Deleções retornam 204 (sem body)
- Isolamento entre usuários é respeitado
"""

from uuid import uuid4


# ─── Helpers ───────────────────────────────────────────────────────────────────


def _make_user(email: str) -> dict:
    """Cria um usuário e retorna os dados de registro."""
    return {
        "email": email,
        "password": "StrongPassword123!",
        "name": "Regression Tester",
    }


def _register_and_login(client, email: str) -> dict:
    """Registra um usuário e faz login, retornando o header de autorização."""
    client.post("/auth/register", json=_make_user(email))
    resp = client.post(
        "/auth/login",
        data={
            "username": email,
            "password": "StrongPassword123!",
        },
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    # Retorna também o refresh_token para testes de refresh
    refresh = resp.json().get("refresh_token", "")
    return {"headers": headers, "token": token, "refresh_token": refresh}


def _unique() -> str:
    return str(uuid4())


# ─── 1. HEALTH CHECK ──────────────────────────────────────────────────────────


class TestHealth:
    def test_health_endpoint(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("healthy", "unhealthy")
        assert data["database"] in ("connected", "disconnected")
        assert "timestamp" in data


# ─── 2. AUTH ──────────────────────────────────────────────────────────────────


class TestAuth:
    def test_register_success(self, client):
        email = f"reg_{_unique()}@cafe.com"
        resp = client.post("/auth/register", json=_make_user(email))
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == email
        assert "id" in data
        assert "password" not in resp.text
        assert "password_hash" not in resp.text

    def test_register_duplicate(self, client):
        email = f"dup_{_unique()}@cafe.com"
        client.post("/auth/register", json=_make_user(email))
        resp = client.post("/auth/register", json=_make_user(email))
        assert resp.status_code == 400

    def test_register_weak_password(self, client):
        email = f"weak_{_unique()}@cafe.com"
        resp = client.post("/auth/register", json={"email": email, "password": "123"})
        assert resp.status_code == 422

    def test_login_success(self, client):
        email = f"login_{_unique()}@cafe.com"
        client.post("/auth/register", json=_make_user(email))
        resp = client.post(
            "/auth/login",
            data={
                "username": email,
                "password": "StrongPassword123!",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        email = f"wrong_{_unique()}@cafe.com"
        client.post("/auth/register", json=_make_user(email))
        resp = client.post(
            "/auth/login",
            data={
                "username": email,
                "password": "WrongPassword!",
            },
        )
        assert resp.status_code == 401

    def test_refresh_token(self, client):
        email = f"refresh_{_unique()}@cafe.com"
        auth_data = _register_and_login(client, email)
        refresh_token = auth_data["refresh_token"]
        assert refresh_token, "No refresh_token returned"
        resp = client.post(
            "/auth/refresh",
            json={
                "refresh_token": refresh_token,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_refresh_with_invalid_token(self, client):
        resp = client.post(
            "/auth/refresh",
            json={
                "refresh_token": "invalid_token_here",
            },
        )
        assert resp.status_code == 401

    def test_get_me(self, client):
        email = f"me_{_unique()}@cafe.com"
        auth_data = _register_and_login(client, email)
        resp = client.get("/auth/me", headers=auth_data["headers"])
        assert resp.status_code == 200
        assert resp.json()["email"] == email

    def test_update_me(self, client):
        email = f"upd_{_unique()}@cafe.com"
        auth_data = _register_and_login(client, email)
        resp = client.patch(
            "/auth/me",
            headers=auth_data["headers"],
            json={
                "name": "Updated Name",
                "company": "NewCo",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Updated Name"
        assert data["company"] == "NewCo"

    def test_me_requires_auth(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_protected_routes_require_auth(self, client):
        """Vários endpoints protegidos devem rejeitar requisições sem token."""
        protected = [
            ("GET", "/companies/"),
            ("POST", "/companies/"),
            ("GET", "/clients/"),
            ("POST", "/clients/"),
            ("GET", "/tasks/"),
            ("POST", "/tasks/"),
            ("GET", "/notifications/"),
            ("POST", "/notifications/"),
            ("GET", "/proposals/"),
            ("POST", "/proposals/"),
            ("GET", "/network/posts"),
            ("POST", "/network/posts"),
            ("GET", "/dashboard/summary"),
        ]
        for method, path in protected:
            resp = client.request(method, path)
            assert resp.status_code == 401, (
                f"{method} {path} expected 401, got {resp.status_code}"
            )


# ─── 3. COMPANIES ─────────────────────────────────────────────────────────────


class TestCompanies:
    def test_create_company(self, client):
        email = f"co_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/companies/",
            headers=auth,
            json={
                "name": "Empresa Teste Ltda",
                "segment": "BPO Financeiro",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Empresa Teste Ltda"
        assert "id" in data

    def test_list_companies(self, client):
        email = f"colist_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        # Create one
        client.post("/companies/", headers=auth, json={"name": "Co A"})
        resp = client.get("/companies/", headers=auth)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_update_company(self, client):
        email = f"coupd_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = client.post("/companies/", headers=auth, json={"name": "Old"}).json()[
            "id"
        ]
        resp = client.put(f"/companies/{cid}", headers=auth, json={"name": "New"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"

    def test_delete_company(self, client):
        email = f"codel_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = client.post("/companies/", headers=auth, json={"name": "Del"}).json()[
            "id"
        ]
        resp = client.delete(f"/companies/{cid}", headers=auth)
        assert resp.status_code == 204
        # Verify it's gone
        list_resp = client.get("/companies/", headers=auth)
        assert len(list_resp.json()) == 0


# ─── 4. CLIENTS ───────────────────────────────────────────────────────────────


class TestClients:
    def test_create_client(self, client):
        email = f"cl_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/clients/",
            headers=auth,
            json={
                "name": "Cliente ABC",
                "email": "abc@test.com",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Cliente ABC"
        assert "id" in data

    def test_list_clients(self, client):
        email = f"cllist_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        client.post("/clients/", headers=auth, json={"name": "Client A"})
        resp = client.get("/clients/", headers=auth)
        assert resp.status_code == 200

    def test_update_client(self, client):
        email = f"clupd_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = client.post("/clients/", headers=auth, json={"name": "Old"}).json()["id"]
        resp = client.put(f"/clients/{cid}", headers=auth, json={"name": "New"})
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"

    def test_delete_client(self, client):
        email = f"cldel_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = client.post("/clients/", headers=auth, json={"name": "Del"}).json()["id"]
        resp = client.delete(f"/clients/{cid}", headers=auth)
        assert resp.status_code == 204


# ─── 5. PROPOSALS (Orçamentos) ────────────────────────────────────────────────


class TestProposals:
    def test_create_proposal(self, client):
        """Proposal requires input_payload and result_payload (not title/status)."""
        email = f"prop_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/proposals/",
            headers=auth,
            json={
                "client_name": "Cliente XYZ",
                "input_payload": {
                    "employees": 10,
                    "invoices": 500,
                    "services": ["BPF", "Conciliação"],
                },
                "result_payload": {
                    "monthly_cost": 15000.0,
                    "annual_savings": 50000.0,
                    "roi": 45.5,
                },
            },
        )
        assert resp.status_code == 201, f"Create proposal failed: {resp.text}"
        data = resp.json()
        assert data["client_name"] == "Cliente XYZ"
        assert "id" in data

    def test_list_proposals(self, client):
        email = f"proplist_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        # Create one first
        client.post(
            "/proposals/",
            headers=auth,
            json={
                "client_name": "Test",
                "input_payload": {},
                "result_payload": {},
            },
        )
        resp = client.get("/proposals/", headers=auth)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_get_proposal(self, client):
        email = f"propget_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        pid = client.post(
            "/proposals/",
            headers=auth,
            json={
                "client_name": "GetTest",
                "input_payload": {},
                "result_payload": {},
            },
        ).json()["id"]
        resp = client.get(f"/proposals/{pid}", headers=auth)
        assert resp.status_code == 200
        assert resp.json()["client_name"] == "GetTest"

    def test_get_proposal_not_found(self, client):
        email = f"propnf_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get(f"/proposals/{uuid4()}", headers=auth)
        assert resp.status_code == 404

    def test_update_proposal(self, client):
        email = f"propupd_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        pid = client.post(
            "/proposals/",
            headers=auth,
            json={
                "client_name": "OldName",
                "input_payload": {},
                "result_payload": {},
            },
        ).json()["id"]
        resp = client.put(
            f"/proposals/{pid}",
            headers=auth,
            json={
                "client_name": "NewName",
                "input_payload": {},
                "result_payload": {},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["client_name"] == "NewName"

    def test_delete_proposal(self, client):
        email = f"propdel_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        pid = client.post(
            "/proposals/",
            headers=auth,
            json={
                "client_name": "DelMe",
                "input_payload": {},
                "result_payload": {},
            },
        ).json()["id"]
        resp = client.delete(f"/proposals/{pid}", headers=auth)
        assert resp.status_code == 204

    def test_proposal_isolation(self, client):
        """Usuário B não deve ver a proposta do usuário A."""
        email_a = f"propiso_a_{_unique()}@cafe.com"
        email_b = f"propiso_b_{_unique()}@cafe.com"
        auth_a = _register_and_login(client, email_a)["headers"]
        auth_b = _register_and_login(client, email_b)["headers"]
        pid_a = client.post(
            "/proposals/",
            headers=auth_a,
            json={
                "client_name": "Secreta",
                "input_payload": {},
                "result_payload": {},
            },
        ).json()["id"]
        # User B tries to access
        resp = client.get(f"/proposals/{pid_a}", headers=auth_b)
        assert resp.status_code == 404


# ─── 6. TASKS ─────────────────────────────────────────────────────────────────


class TestTasks:
    def _create_client(self, client, auth) -> str:
        resp = client.post("/clients/", headers=auth, json={"name": "Task Client"})
        return resp.json()["id"]

    def test_create_task(self, client):
        email = f"task_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = self._create_client(client, auth)
        resp = client.post(
            "/tasks/",
            headers=auth,
            json={
                "title": "Tarefa Importante",
                "description": "Fazer algo urgente",
                "client_id": cid,
                "status": "todo",
                "priority": "high",
            },
        )
        assert resp.status_code == 201, f"Create task failed: {resp.text}"
        data = resp.json()
        assert data["title"] == "Tarefa Importante"
        assert "id" in data

    def test_list_tasks(self, client):
        email = f"tasklist_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/tasks/", headers=auth)
        assert resp.status_code == 200

    def test_update_task(self, client):
        email = f"taskupd_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = self._create_client(client, auth)
        tid = client.post(
            "/tasks/",
            headers=auth,
            json={
                "title": "Original",
                "client_id": cid,
            },
        ).json()["id"]
        resp = client.put(
            f"/tasks/{tid}",
            headers=auth,
            json={
                "title": "Updated",
            },
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated"

    def test_delete_task(self, client):
        email = f"taskdel_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = self._create_client(client, auth)
        tid = client.post(
            "/tasks/",
            headers=auth,
            json={
                "title": "Delete Me",
                "client_id": cid,
            },
        ).json()["id"]
        resp = client.delete(f"/tasks/{tid}", headers=auth)
        assert resp.status_code == 204

    def test_task_not_found(self, client):
        """Não existe GET /tasks/{id}, mas PUT retorna 404 para ID inexistente."""
        email = f"tasknf_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.put(f"/tasks/{uuid4()}", headers=auth, json={"title": "N/A"})
        assert resp.status_code == 404

    def test_task_requires_client_id(self, client):
        """Tarefa sem client_id deve falhar na validação."""
        email = f"taskval_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/tasks/",
            headers=auth,
            json={
                "title": "No client",
            },
        )
        assert resp.status_code == 422

    def test_task_phases(self, client):
        email = f"taskph_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        # Create a phase
        resp = client.post(
            "/tasks/phases/",
            headers=auth,
            json={
                "name": "Em Andamento",
                "color": "#ffcc00",
            },
        )
        assert resp.status_code == 201
        # List phases
        resp = client.get("/tasks/phases/", headers=auth)
        assert resp.status_code == 200

    def test_task_sla(self, client):
        email = f"tasksla_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        cid = self._create_client(client, auth)
        resp = client.post(
            "/tasks/sla/",
            headers=auth,
            json={
                "client_id": cid,
                "process_type": "BPF",
                "sla_days": 5,
                "warning_threshold": 0.8,
            },
        )
        assert resp.status_code == 201

    def test_task_templates(self, client):
        email = f"tasktmpl_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/tasks/templates/",
            headers=auth,
            json={
                "name": "Template Teste",
                "description": "Descrição",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Template Teste"


# ─── 7. NOTIFICATIONS ─────────────────────────────────────────────────────────


class TestNotifications:
    def test_create_notification(self, client):
        email = f"notif_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/notifications/",
            headers=auth,
            json={
                "title": "Notificação Teste",
                "message": "Mensagem importante",
                "type": "info",
            },
        )
        assert resp.status_code == 201

    def test_list_notifications(self, client):
        email = f"notiflist_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/notifications/", headers=auth)
        assert resp.status_code == 200

    def test_unread_count(self, client):
        email = f"notifcnt_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/notifications/unread-count", headers=auth)
        assert resp.status_code == 200

    def test_mark_all_read(self, client):
        email = f"notifmar_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post("/notifications/mark-all-read", headers=auth)
        assert resp.status_code == 200


# ─── 8. DASHBOARD ─────────────────────────────────────────────────────────────


class TestDashboard:
    def test_dashboard_summary(self, client):
        email = f"dash_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/dashboard/summary", headers=auth)
        assert resp.status_code == 200
        data = resp.json()
        # Should have basic dashboard fields
        assert isinstance(data, dict)


# ─── 9. NETWORK (Fórum) ───────────────────────────────────────────────────────


class TestNetwork:
    def test_create_post(self, client):
        """Network post uses 'message' field, not 'content'."""
        email = f"net_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post(
            "/network/posts",
            headers=auth,
            json={
                "title": "Post do Fórum",
                "message": "Conteúdo da publicação",
                "tags": ["bpo", "duvida"],
            },
        )
        assert resp.status_code == 201, f"Create post failed: {resp.text}"
        data = resp.json()
        assert data["title"] == "Post do Fórum"
        assert "id" in data

    def test_list_posts(self, client):
        email = f"netlist_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/network/posts", headers=auth)
        assert resp.status_code == 200

    def test_create_comment(self, client):
        email = f"netcmt_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        pid = client.post(
            "/network/posts",
            headers=auth,
            json={
                "title": "Post",
                "message": "Body",
            },
        ).json()["id"]
        resp = client.post(
            f"/network/posts/{pid}/comments",
            headers=auth,
            json={
                "message": "Comentário de teste",
            },
        )
        assert resp.status_code == 201

    def test_list_comments(self, client):
        email = f"netcmtl_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        pid = client.post(
            "/network/posts",
            headers=auth,
            json={
                "title": "Post",
                "message": "Body",
            },
        ).json()["id"]
        resp = client.get(f"/network/posts/{pid}/comments", headers=auth)
        assert resp.status_code == 200

    def test_network_notifications(self, client):
        email = f"netnotif_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/network/notifications", headers=auth)
        assert resp.status_code == 200


# ─── 10. GALLERY ──────────────────────────────────────────────────────────────


class TestGallery:
    def test_list_gallery(self, client):
        email = f"gal_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/gallery/", headers=auth)
        assert resp.status_code == 200

    def test_common_gallery_list_public(self, client):
        """Common gallery list is public (no auth)."""
        resp = client.get("/gallery/common")
        assert resp.status_code == 200

    def test_common_gallery_upload_rejects_regular_user(self, client):
        """Regular user cannot upload to common gallery."""
        email = f"galcommon_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.post("/gallery/common/upload", headers=auth, files={
            "file": ("test.pdf", b"x", "application/pdf"),
        })
        assert resp.status_code == 403


# ─── 11. PRICING (público) ────────────────────────────────────────────────────


class TestPricing:
    def test_calculate_pricing(self, client):
        resp = client.post(
            "/pricing/calculate",
            json={
                "operation": {
                    "total_cost": "50000.00",
                    "people_count": 10,
                    "hours_per_month": "160",
                    "tax_rate": "0.1",
                },
                "services": [
                    {
                        "name": "BPF",
                        "minutes_per_execution": "30",
                        "monthly_quantity": 500,
                    }
                ],
                "desired_profit_margin": "20.0",
            },
        )
        assert resp.status_code == 200, f"Pricing calculate failed: {resp.text}"
        data = resp.json()
        assert isinstance(data, dict)

    def test_calculate_pricing_invalid(self, client):
        """Pricing sem campos obrigatórios."""
        resp = client.post(
            "/pricing/calculate",
            json={
                "employees": 50,
            },
        )
        assert resp.status_code == 422


# ─── 12. PAYMENTS ─────────────────────────────────────────────────────────────


class TestPayments:
    def test_list_payments(self, client):
        email = f"pay_{_unique()}@cafe.com"
        auth = _register_and_login(client, email)["headers"]
        resp = client.get("/payments/", headers=auth)
        assert resp.status_code == 200
