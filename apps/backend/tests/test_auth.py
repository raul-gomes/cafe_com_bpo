from uuid import uuid4

from tests.helpers import create_test_user, register_user


def test_login_returns_access_token(client):
    email = f"login_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    register_user(payload=payload)

    form_data = {"username": email, "password": "StrongPassword123!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_rejects_wrong_password(client):
    email = f"loginwrong_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    register_user(payload=payload)

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
    create_test_user(email=email)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert "password" not in me.text
    assert "password_hash" not in me.text


def test_error_messages_do_not_allow_user_enumeration(client):
    form_data = {"username": f"unknown_{uuid4()}@cafe.com", "password": "AnyPassword!"}
    response = client.post("/auth/login", data=form_data)
    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais inválidas"


def test_login_wrong_password_returns_generic_message(client):
    email = f"wrongpass_{uuid4()}@cafe.com"
    create_test_user(email=email, password="StrongPassword123!")

    response = client.post(
        "/auth/login", data={"username": email, "password": "WrongPassword!"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciais inválidas"


def test_upload_avatar_success(client, monkeypatch):
    """Mock CloudinaryService.upload_file to avoid external API calls."""
    email = f"avatar_user_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    register_user(payload=payload)
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
    register_user(payload={"email": email, "password": "StrongPassword123!"})
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
    assert data["company_cnpj"] == "12345678000199"
    assert data["company_address"] == "Rua Exemplo, 123"
    assert data["company_professional_email"] == "contato@minhaempresa.com"
    assert data["company_commercial_phone"] == "1133334444"
    assert data["company_logo_url"] == "https://example.com/logo.png"
    assert data["company_color_code"] == "#3b82f6"

    # GET also returns them
    resp_get = client.get("/auth/me", headers=headers)
    assert resp_get.status_code == 200
    assert resp_get.json()["whatsapp"] == "11988887777"


def test_update_profile_sanitizes_cnpj_and_phones(client):
    """PATCH /auth/me normaliza CNPJ e telefones (remove máscara/pontuação)."""
    email = f"sani_{uuid4()}@cafe.com"
    register_user(payload={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/auth/me",
        json={
            "whatsapp": "(11) 98888-7777",
            "company_cnpj": "12.345.678/0001-99",
            "company_commercial_phone": "+55 11 3333-4444",
        },
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["whatsapp"] == "11988887777"
    assert data["company_cnpj"] == "12345678000199"
    assert data["company_commercial_phone"] == "551133334444"


def test_update_profile_rejects_empty_sanitized_field(client):
    """PATCH /auth/me rejeita campo que fica vazio após remover não-dígitos."""
    email = f"sani_empty_{uuid4()}@cafe.com"
    register_user(payload={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch("/auth/me", json={"whatsapp": "abc-()/"}, headers=headers)
    assert resp.status_code == 422


def test_update_profile_accepts_empty_phone_and_cnpj(client):
    """PATCH /auth/me aceita telefone/CNPJ vazios (ex.: aba Personalização)."""
    email = f"sani_empty_ok_{uuid4()}@cafe.com"
    register_user(payload={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch(
        "/auth/me",
        json={"whatsapp": "", "company_cnpj": "", "company_commercial_phone": ""},
        headers=headers,
    )
    assert resp.status_code == 200


def test_update_profile_partial_update(client):
    """PATCH /auth/me permite atualizar apenas um campo sem afetar outros"""
    email = f"partial_{uuid4()}@cafe.com"
    register_user(payload={"email": email, "password": "StrongPassword123!"})
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
    register_user(payload={"email": email, "password": "StrongPassword123!"})
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.patch("/auth/me", json={"email": "hacked@evil.com"}, headers=headers)
    # email is not a valid field in ProfileUpdate, so it's ignored
    # resulting in empty update -> 400
    assert resp.status_code == 400
    assert "Nenhum campo" in resp.text


# ── Company Logo Upload (Item 8) ──


def test_upload_company_logo_success(client, monkeypatch):
    """Faz upload da logo da empresa com mock do Cloudinary."""
    email = f"logo_{uuid4()}@cafe.com"
    payload = {"email": email, "password": "StrongPassword123!"}
    register_user(payload=payload)
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    # Mock Cloudinary upload
    async def mock_upload(
        content: bytes, user_id: str, folder: str = "avatars"
    ) -> dict:
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
    register_user(payload={"email": email, "password": "StrongPassword123!"})
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
    """User created with mixed-case email, login with different case — must succeed."""
    email_mixed = f"CaseTest_{uuid4()}@Example.COM"
    create_test_user(email=email_mixed)

    # Login with different case works
    login_resp = client.post(
        "/auth/login",
        data={"username": email_mixed.upper(), "password": "StrongPassword123!"},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
