from uuid import uuid4


def test_upload_gallery_file_success(client):
    """Test successful file upload to gallery."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    file_content = b"fake pdf content"
    files = {"file": ("test.pdf", file_content, "application/pdf")}

    response = client.post(
        "/gallery/upload?title=Test%20Document&description=A%20test%20PDF%20file",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["file_name"] == "test.pdf"
    assert data["title"] == "Test Document"
    assert data["description"] == "A test PDF file"
    assert data["file_size"] == len(file_content)
    assert "id" in data


def test_upload_gallery_file_rejects_unauthorized(client):
    """Test that upload requires authentication."""
    files = {"file": ("test.pdf", b"content", "application/pdf")}
    response = client.post("/gallery/upload", files=files)
    assert response.status_code == 401


def test_upload_gallery_file_rejects_invalid_extension(client):
    """Test that upload rejects disallowed file types."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    files = {"file": ("test.exe", b"malicious", "application/x-msdownload")}
    response = client.post(
        "/gallery/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    assert response.status_code == 400
    assert "não permitido" in response.json()["detail"]


def test_upload_gallery_file_rejects_large_file(client):
    """Test that upload rejects files exceeding 10MB limit."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    large_content = b"x" * (11 * 1024 * 1024)
    files = {"file": ("large.pdf", large_content, "application/pdf")}
    response = client.post(
        "/gallery/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    assert response.status_code == 413
    assert "muito grande" in response.json()["detail"]


def test_list_gallery_files(client):
    """Test listing gallery files for authenticated user."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    files = {"file": ("test.pdf", b"content", "application/pdf")}
    client.post(
        "/gallery/upload?title=My%20File",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    response = client.get("/gallery/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "My File"


def test_delete_gallery_file(client):
    """Test deleting a gallery file."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    files = {"file": ("test.pdf", b"content", "application/pdf")}
    upload_resp = client.post(
        "/gallery/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    file_id = upload_resp.json()["id"]

    delete_resp = client.delete(
        f"/gallery/{file_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 204

    list_resp = client.get("/gallery/", headers={"Authorization": f"Bearer {token}"})
    assert len(list_resp.json()) == 0


def test_delete_gallery_file_rejects_other_user(client):
    """Test that user cannot delete another user's files."""
    email1 = f"gallery1_{uuid4()}@cafe.com"
    email2 = f"gallery2_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email1, "password": "StrongPassword123!"}
    )
    client.post(
        "/auth/register", json={"email": email2, "password": "StrongPassword123!"}
    )

    resp1 = client.post(
        "/auth/login", data={"username": email1, "password": "StrongPassword123!"}
    )
    token1 = resp1.json()["access_token"]
    resp2 = client.post(
        "/auth/login", data={"username": email2, "password": "StrongPassword123!"}
    )
    token2 = resp2.json()["access_token"]

    files = {"file": ("test.pdf", b"content", "application/pdf")}
    upload_resp = client.post(
        "/gallery/upload",
        headers={"Authorization": f"Bearer {token1}"},
        files=files,
    )
    file_id = upload_resp.json()["id"]

    delete_resp = client.delete(
        f"/gallery/{file_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert delete_resp.status_code == 404


# ── Common Gallery Tests ──────────────────────────────────────────────────────


def _create_admin_user(client, db_session):
    """Helper: cria um usuário admin diretamente no banco e retorna token."""
    from src.modules.auth.models import User
    from src.core.security import PasswordService

    email = f"admin_{uuid4()}@cafe.com"
    pw_hash = PasswordService.hash_password("Admin@123456")
    user = User(
        email=email,
        password_hash=pw_hash,
        name="Admin Test",
        role="admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    resp = client.post(
        "/auth/login", data={"username": email, "password": "Admin@123456"}
    )
    return resp.json()["access_token"]


def test_common_gallery_list_public(client):
    """Test that common gallery list is public (no auth required)."""
    resp = client.get("/gallery/common")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_common_gallery_upload_admin(client, db_session):
    """Test that admin can upload to common gallery."""
    token = _create_admin_user(client, db_session)
    file_content = b"common file content"
    files = {"file": ("common.pdf", file_content, "application/pdf")}
    resp = client.post(
        "/gallery/common/upload?title=Common%20Doc",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["file_name"] == "common.pdf"
    assert data["title"] == "Common Doc"
    assert data["file_size"] == len(file_content)
    assert "id" in data


def test_common_gallery_upload_rejects_regular_user(client):
    """Test that regular user cannot upload to common gallery."""
    email = f"regular_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    token = resp.json()["access_token"]

    files = {"file": ("hack.pdf", b"x", "application/pdf")}
    resp = client.post(
        "/gallery/common/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    assert resp.status_code == 403


def test_common_gallery_upload_requires_auth(client):
    """Test that common upload requires authentication."""
    files = {"file": ("test.pdf", b"x", "application/pdf")}
    resp = client.post("/gallery/common/upload", files=files)
    assert resp.status_code == 401


def test_common_gallery_delete_admin(client, db_session):
    """Test that admin can delete a common file."""
    token = _create_admin_user(client, db_session)
    files = {"file": ("delete.pdf", b"to delete", "application/pdf")}
    upload = client.post(
        "/gallery/common/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    file_id = upload.json()["id"]

    resp = client.delete(
        f"/gallery/common/{file_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204

    # Confirm it's gone
    list_resp = client.get("/gallery/common")
    ids = [f["id"] for f in list_resp.json()]
    assert file_id not in ids


def test_common_gallery_delete_rejects_regular_user(client, db_session):
    """Test that regular user cannot delete a common file."""
    # First admin creates a file
    admin_token = _create_admin_user(client, db_session)
    files = {"file": ("protected.pdf", b"x", "application/pdf")}
    upload = client.post(
        "/gallery/common/upload",
        headers={"Authorization": f"Bearer {admin_token}"},
        files=files,
    )
    file_id = upload.json()["id"]

    # Regular user tries to delete
    email = f"regular2_{uuid4()}@cafe.com"
    client.post(
        "/auth/register", json={"email": email, "password": "StrongPassword123!"}
    )
    resp = client.post(
        "/auth/login", data={"username": email, "password": "StrongPassword123!"}
    )
    user_token = resp.json()["access_token"]

    resp = client.delete(
        f"/gallery/common/{file_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert resp.status_code == 403
