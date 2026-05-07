import pytest
from uuid import uuid4


def test_upload_gallery_file_success(client):
    """Test successful file upload to gallery."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]

    file_content = b"fake pdf content"
    files = {"file": ("test.pdf", file_content, "application/pdf")}

    response = client.post(
        "/api/gallery/upload?title=Test%20Document&description=A%20test%20PDF%20file",
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
    response = client.post("/api/gallery/upload", files=files)
    assert response.status_code == 401


def test_upload_gallery_file_rejects_invalid_extension(client):
    """Test that upload rejects disallowed file types."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]

    files = {"file": ("test.exe", b"malicious", "application/x-msdownload")}
    response = client.post(
        "/api/gallery/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    assert response.status_code == 400
    assert "não permitido" in response.json()["detail"]


def test_upload_gallery_file_rejects_large_file(client):
    """Test that upload rejects files exceeding 10MB limit."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]

    large_content = b"x" * (11 * 1024 * 1024)
    files = {"file": ("large.pdf", large_content, "application/pdf")}
    response = client.post(
        "/api/gallery/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    assert response.status_code == 413
    assert "muito grande" in response.json()["detail"]


def test_list_gallery_files(client):
    """Test listing gallery files for authenticated user."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]

    files = {"file": ("test.pdf", b"content", "application/pdf")}
    client.post(
        "/api/gallery/upload?title=My%20File",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )

    response = client.get("/api/gallery/", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "My File"


def test_delete_gallery_file(client):
    """Test deleting a gallery file."""
    email = f"gallery_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email, "password": "StrongPassword123!"})
    resp = client.post("/auth/login", data={"username": email, "password": "StrongPassword123!"})
    token = resp.json()["access_token"]

    files = {"file": ("test.pdf", b"content", "application/pdf")}
    upload_resp = client.post(
        "/api/gallery/upload",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
    )
    file_id = upload_resp.json()["id"]

    delete_resp = client.delete(
        f"/api/gallery/{file_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert delete_resp.status_code == 204

    list_resp = client.get("/api/gallery/", headers={"Authorization": f"Bearer {token}"})
    assert len(list_resp.json()) == 0


def test_delete_gallery_file_rejects_other_user(client):
    """Test that user cannot delete another user's files."""
    email1 = f"gallery1_{uuid4()}@cafe.com"
    email2 = f"gallery2_{uuid4()}@cafe.com"
    client.post("/auth/register", json={"email": email1, "password": "StrongPassword123!"})
    client.post("/auth/register", json={"email": email2, "password": "StrongPassword123!"})

    resp1 = client.post("/auth/login", data={"username": email1, "password": "StrongPassword123!"})
    token1 = resp1.json()["access_token"]
    resp2 = client.post("/auth/login", data={"username": email2, "password": "StrongPassword123!"})
    token2 = resp2.json()["access_token"]

    files = {"file": ("test.pdf", b"content", "application/pdf")}
    upload_resp = client.post(
        "/api/gallery/upload",
        headers={"Authorization": f"Bearer {token1}"},
        files=files,
    )
    file_id = upload_resp.json()["id"]

    delete_resp = client.delete(
        f"/api/gallery/{file_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert delete_resp.status_code == 404
