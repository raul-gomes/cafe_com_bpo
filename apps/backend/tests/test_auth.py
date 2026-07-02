from uuid import uuid4


def test_register_user_returns_201_and_user_payload(client):
    email = f"test_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 201
    assert response.json()["email"] == email
    assert "id" in response.json()


def test_register_rejects_duplicate_email(client):
    email = f"duplicate_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400
    assert "uso" in response.text


def test_register_rejects_weak_password(client):
    email = f"weak_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "123"}
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 422


def test_login_returns_access_token(client):
    email = f"login_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)

    form_data = {"username": email, "password": "StrongPassword123!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_rejects_wrong_password(client):
    email = f"loginwrong_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)

    form_data = {"username": email, "password": "WrongPassword!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 401


def test_protected_route_rejects_missing_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_protected_route_rejects_expired_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer BAD_TOKEN"})
    assert response.status_code == 401


def test_auth_response_never_returns_password_hash(client):
    email = f"safe_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    response = client.post("/auth/register", json=payload)
    assert "password" not in response.text
    assert "password_hash" not in response.text


def test_error_messages_do_not_allow_user_enumeration(client):
    form_data = {"username": f"unknown_{uuid4()}@cafe.com", "password": "AnyPassword!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais inválidas"


def test_upload_avatar_success(client, monkeypatch):
    """Mock CloudinaryService.upload_file to avoid external API calls."""
    email = f"avatar_user_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    # Mock Cloudinary upload
    async def mock_upload(content: bytes, user_id: str) -> dict:
        return {
            "id": "test_public_id",
            "url": "https://res.cloudinary.com/test/avatar.png",
        }

    monkeypatch.setattr(
        "src.modules.auth.storage_service.CloudinaryService.upload_file", mock_upload
    )

    # Fake file payload
    file_payload = {"file": ("test_avatar.png", b"fake_image_content", "image/png")}
    response = client.post(
        "/auth/me/avatar",
        headers={"Authorization": f"Bearer {token}"},
        files=file_payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert "avatar_url" in data
    assert data["avatar_url"] == "https://res.cloudinary.com/test/avatar.png"


def test_upload_avatar_requires_auth(client):
    file_payload = {"file": ("test_avatar.png", b"fake_image_content", "image/png")}
    response = client.post("/auth/me/avatar", files=file_payload)

    assert response.status_code == 401


def test_update_profile_with_company_fields(client):
    """Tarefa 3.2: PATCH /auth/me atualiza todos os campos de perfil/empresa"""
    email = f"profile_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    update_payload = {
        "whatsapp": "11988887777",
        "company_razao_social": "Minha Empresa Ltda",
        "company_nome_fantasia": "Minha Empresa",
        "company_cnpj": "12.345.678/0001-99",
        "company_address": "Rua Exemplo, 123",
        "company_professional_email": "contato@minhaempresa.com",
        "company_commercial_phone": "1133334444",
        "company_logo_url": "https://example.com/logo.png",
        "company_color_code": "#3b82f6",
    }

    resp = client.patch("/auth/me", json=update_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert data["whatsapp"] == "11988887777"
    assert data["company_razao_social"] == "Minha Empresa Ltda"
    assert data["company_nome_fantasia"] == "Minha Empresa"
    assert data["company_cnpj"] == "12.345.678/0001-99"
    assert data["company_address"] == "Rua Exemplo, 123"
    assert data["company_professional_email"] == "contato@minhaempresa.com"
    assert data["company_commercial_phone"] == "1133334444"
    assert data["company_logo_url"] == "https://example.com/logo.png"
    assert data["company_color_code"] == "#3b82f6"

    # GET also returns them
    resp_get = client.get("/auth/me", headers=headers)
    assert resp_get.status_code == 200
    assert resp_get.json()["whatsapp"] == "11988887777"


def test_update_profile_partial_update(client):
    """PATCH /auth/me permite atualizar apenas um campo sem afetar outros"""
    email = f"partial_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Set all fields first
    full_payload = {
        "whatsapp": "11911112222",
        "company_razao_social": "Razão Social",
        "company_address": "Endereço Completo",
    }
    client.patch("/auth/me", json=full_payload, headers=headers)

    # Update only whatsapp
    resp = client.patch("/auth/me", json={"whatsapp": "11933334444"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["whatsapp"] == "11933334444"
    # Other fields should persist
    assert data["company_razao_social"] == "Razão Social"
    assert data["company_address"] == "Endereço Completo"


def test_update_profile_does_not_allow_email_change(client):
    """PATCH /auth/me NÃO permite alterar o email (campo rejeitado)"""
    email = f"noemail_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/auth/me", json={"email": "hacked@evil.com"}, headers=headers
    )
    # email is not a valid field in ProfileUpdate, so it's ignored
    # resulting in empty update -> 400
    assert resp.status_code == 400
    assert "Nenhum campo" in resp.text


# ── Company Logo Upload (Item 8) ──


def test_upload_company_logo_success(client, monkeypatch):
    """Faz upload da logo da empresa com mock do Cloudinary."""
    email = f"logo_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    client.post("/auth/register", json=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    # Mock Cloudinary upload
    async def mock_upload(content: bytes, user_id: str, folder: str = "avatars") -> dict:
        return {
            "id": f"cafe_com_bpo/{folder}/{user_id}/logo_123456789",
            "url": f"https://res.cloudinary.com/test/logo_{folder}.png",
        }

    monkeypatch.setattr(
        "src.modules.auth.storage_service.CloudinaryService.upload_file", mock_upload
    )

    file_payload = {"file": ("logo.png", b"fake_logo_content", "image/png")}
    response = client.post(
        "/auth/me/company-logo",
        headers={"Authorization": f"Bearer {token}"},
        files=file_payload,
    )

    assert response.status_code == 200
    data = response.json()
    assert "company_logo_url" in data
    assert data["company_logo_url"] == "https://res.cloudinary.com/test/logo_logos.png"


def test_upload_company_logo_requires_auth(client):
    """Sem token → 401."""
    file_payload = {"file": ("logo.png", b"fake_logo_content", "image/png")}
    response = client.post("/auth/me/company-logo", files=file_payload)
    assert response.status_code == 401


def test_upload_company_logo_invalid_extension(client):
    """Extensão inválida → 400."""
    email = f"logo_inv_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    file_payload = {"file": ("logo.txt", b"not_an_image", "text/plain")}
    response = client.post(
        "/auth/me/company-logo",
        headers={"Authorization": f"Bearer {token}"},
        files=file_payload,
    )
    assert response.status_code == 400
    assert "Formato de imagem inválido" in response.text


def test_login_email_case_insensitive(client):
    """Register with mixed-case email, login with different case — must succeed."""
    email_mixed = f"CaseTest_{uuid4()}@Example.COM"
    email_lower = email_mixed.lower()
    payload = {"email": email_mixed, "password": "StrongPassword123!"}
    register_resp = client.post("/auth/register", json=payload)
    assert register_resp.status_code == 201
    # Email stored as lowercase
    assert register_resp.json()["email"] == email_lower

    # Login with different case works
    login_resp = client.post(
        "/auth/login",
        data={"username": email_mixed.upper(), "password": "StrongPassword123!"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()


def test_register_rejects_case_insensitive_duplicate(client):
    """Registering with same email but different case must be rejected."""
    unique = uuid4().hex[:6]
    email1 = f"DupCase_{unique}@cafe.com"
    email2 = email1.upper()

    resp1 = client.post(
        "/auth/register", json={"email": email1, "password": "StrongPassword123!"}
    )
    assert resp1.status_code == 201

    resp2 = client.post(
        "/auth/register", json={"email": email2, "password": "StrongPassword123!"}
    )
    assert resp2.status_code == 400
    assert "uso" in resp2.text
