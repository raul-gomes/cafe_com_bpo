"""Regressões de autorização do download da galeria.

Duas rotas serviam arquivo por nome, sem autenticação nenhuma:
`GET /gallery/download/{filename}` (galeria privada) e
`GET /gallery/common/download/{filename}` (galeria comunitária). Qualquer
request anônimo baixava documento de cliente — inclusive o de outro usuário,
basta conhecer o nome do arquivo.

A posse é resolvida pela **linha do banco** (`gallery_items.file_path`), não pela
existência do arquivo em disco: um arquivo órfão em `storage/gallery/` não pode
virar download liberado só porque o nome existe.
"""

import os
from uuid import uuid4

import pytest

from src.modules.gallery.models import CommonGalleryItem, GalleryItem
from tests.helpers import create_test_user, register_user


def _user_id(db_session, email: str):
    """Returns the id of a registered user without touching a detached instance.

    Args:
        db_session: Test database session.
        email: Email of the user.

    Returns:
        The user id as a UUID.
    """
    from src.modules.auth.models import User

    found = db_session.query(User.id).filter_by(email=email.lower()).first()
    assert found is not None, f"usuário {email} não encontrado"
    return found[0]


GALLERY_DIR = "storage/gallery"
COMMON_DIR = "storage/gallery/common"


def _auth(client, email: str, password: str = "StrongPassword123!") -> dict:
    """Registers (when needed) a user and returns its auth header.

    Args:
        client: FastAPI test client.
        email: Email of the user.
        password: Password used both to create and to log the user in.

    Returns:
        Authorization header for the user.
    """
    from src.core.database import SessionLocal
    from src.modules.auth.models import User

    session = SessionLocal()
    try:
        exists = session.query(User.id).filter_by(email=email.lower()).first()
    finally:
        session.close()
    if exists is None:
        register_user(payload={"email": email, "password": password})
    token = client.post(
        "/auth/login", data={"username": email, "password": password}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def private_file(db_session, request):
    """Creates a gallery file on disk plus its `GalleryItem` row.

    Args:
        db_session: Test database session.
        request: Pytest request used to register the cleanup.

    Returns:
        Tuple of the stored filename and the owner email.
    """
    owner_email = f"gal_{uuid4()}@cafe.com"
    create_test_user(email=owner_email, password="StrongPassword123!")
    filename = f"{uuid4().hex}.pdf"
    os.makedirs(GALLERY_DIR, exist_ok=True)
    path = os.path.join(GALLERY_DIR, filename)
    with open(path, "wb") as handle:
        handle.write(b"%PDF-1.4 confidential client document")
    db_session.add(
        GalleryItem(
            user_id=_user_id(db_session, owner_email),
            file_name="contrato.pdf",
            file_path=f"/gallery/download/{filename}",
            file_type="application/pdf",
            file_size=34,
        )
    )
    db_session.commit()

    def _cleanup() -> None:
        if os.path.exists(path):
            os.remove(path)

    request.addfinalizer(_cleanup)
    return filename, owner_email


@pytest.fixture
def common_file(db_session, request):
    """Creates a community gallery file on disk plus its row.

    Args:
        db_session: Test database session.
        request: Pytest request used to register the cleanup.

    Returns:
        The stored filename.
    """
    filename = f"{uuid4().hex}.txt"
    os.makedirs(COMMON_DIR, exist_ok=True)
    path = os.path.join(COMMON_DIR, filename)
    with open(path, "wb") as handle:
        handle.write(b"modelo comunitario")
    admin_email = f"gal_adm_{uuid4()}@cafe.com"
    create_test_user(email=admin_email, password="StrongPassword123!", role="admin")
    db_session.add(
        CommonGalleryItem(
            created_by=_user_id(db_session, admin_email),
            file_name="modelo.txt",
            file_path=f"/gallery/common/download/{filename}",
            file_type="text/plain",
            file_size=18,
        )
    )
    db_session.commit()

    def _cleanup() -> None:
        if os.path.exists(path):
            os.remove(path)

    request.addfinalizer(_cleanup)
    return filename


def test_anonymous_cannot_download_a_private_gallery_file(client, private_file):
    """The regression: a document was downloadable without any credential."""
    filename, _email = private_file

    resp = client.get(f"/gallery/download/{filename}")

    assert resp.status_code in (401, 403), resp.text
    assert b"confidential" not in resp.content


def test_another_user_cannot_download_a_private_gallery_file(client, private_file):
    """Knowing the filename is not authorization."""
    filename, _email = private_file
    auth_b = _auth(client, f"intruder_{uuid4()}@cafe.com")

    resp = client.get(f"/gallery/download/{filename}", headers=auth_b)

    assert resp.status_code == 404, resp.text
    assert b"confidential" not in resp.content


def test_owner_downloads_own_gallery_file(client, private_file):
    """The fix must keep the legitimate download working."""
    filename, owner_email = private_file
    auth_owner = _auth(client, owner_email)

    resp = client.get(f"/gallery/download/{filename}", headers=auth_owner)

    assert resp.status_code == 200, resp.text
    assert b"confidential" in resp.content


def test_file_on_disk_without_row_is_not_downloadable(client):
    """Authorization comes from the row, not from the file existing.

    An orphan left in `storage/gallery/` (failed upload, manual copy) would be
    served to anyone if the check were `os.path.exists`.
    """
    os.makedirs(GALLERY_DIR, exist_ok=True)
    filename = f"{uuid4().hex}.pdf"
    path = os.path.join(GALLERY_DIR, filename)
    with open(path, "wb") as handle:
        handle.write(b"orphan")
    try:
        auth = _auth(client, f"orphan_{uuid4()}@cafe.com")

        resp = client.get(f"/gallery/download/{filename}", headers=auth)

        assert resp.status_code == 404, resp.text
    finally:
        os.remove(path)


def test_path_traversal_is_refused(client, private_file):
    """The route takes a path segment, but traversal must not escape the dir."""
    auth = _auth(client, f"trav_{uuid4()}@cafe.com")

    resp = client.get("/gallery/download/..%2F..%2F.env", headers=auth)

    assert resp.status_code in (401, 403, 404), resp.text


def test_anonymous_cannot_download_a_common_gallery_file(client, common_file):
    """Community files are shared between members, not with the internet."""
    resp = client.get(f"/gallery/common/download/{common_file}")

    assert resp.status_code in (401, 403), resp.text
    assert b"comunitario" not in resp.content


def test_member_downloads_a_common_gallery_file(client, common_file):
    """Any authenticated member may fetch the shared document."""
    auth = _auth(client, f"member_{uuid4()}@cafe.com")

    resp = client.get(f"/gallery/common/download/{common_file}", headers=auth)

    assert resp.status_code == 200, resp.text
    assert b"comunitario" in resp.content
