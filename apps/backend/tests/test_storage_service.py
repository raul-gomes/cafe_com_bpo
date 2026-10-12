"""Cloudinary adapter rules, with the SDK replaced (no network)."""

import asyncio

import cloudinary.uploader

from src.modules.auth import storage_service
from src.modules.auth.storage_service import CloudinaryService


def _fake_upload(calls: list):
    """Builds an uploader.upload stand-in that records its arguments."""

    def upload(content, **kwargs):
        calls.append(kwargs)
        return {
            "public_id": f"{kwargs['folder']}/{kwargs['public_id']}",
            "secure_url": "https://res.example/x",
        }

    return upload


def test_two_uploads_in_the_same_second_get_different_ids(monkeypatch):
    """AUD-025: a timestamp id collided and overwrite=True replaced the file."""
    calls: list = []
    monkeypatch.setattr(storage_service, "_cloudinary_configured", lambda: True)
    monkeypatch.setattr(cloudinary.uploader, "upload", _fake_upload(calls))
    monkeypatch.setattr(storage_service.time, "time", lambda: 1_790_000_000)

    first = asyncio.run(CloudinaryService.upload_file(b"a", "u1"))
    second = asyncio.run(CloudinaryService.upload_file(b"b", "u1"))

    assert first["id"] != second["id"]
    assert all(call["overwrite"] is False for call in calls)


def test_raw_files_are_destroyed_as_raw(monkeypatch):
    """AUD-026: destroy defaults to image; a raw file needs its resource type."""
    destroyed: list = []
    monkeypatch.setattr(storage_service, "_cloudinary_configured", lambda: True)
    monkeypatch.setattr(
        cloudinary.uploader,
        "destroy",
        lambda public_id, **kwargs: (
            destroyed.append((public_id, kwargs)) or {"result": "ok"}
        ),
    )

    ok = asyncio.run(CloudinaryService.delete_file("gallery/doc", resource_type="raw"))

    assert ok is True
    assert destroyed == [("gallery/doc", {"resource_type": "raw"})]


def test_a_failed_destroy_is_reported(monkeypatch):
    monkeypatch.setattr(storage_service, "_cloudinary_configured", lambda: True)
    monkeypatch.setattr(
        cloudinary.uploader,
        "destroy",
        lambda public_id, **kwargs: {"result": "not found"},
    )

    assert (
        asyncio.run(CloudinaryService.delete_file("gallery/doc", resource_type="raw"))
        is False
    )
