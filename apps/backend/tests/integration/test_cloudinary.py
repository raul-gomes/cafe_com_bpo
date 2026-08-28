"""Testes de integração com Cloudinary (upload/delete real).

Roda APENAS com: pytest -m integration
Requer: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET no .env
Cria e remove um arquivo temporário no Cloudinary.
"""

import asyncio

import pytest

from src.core.config import get_settings
from src.modules.auth.storage_service import CloudinaryService

pytestmark = pytest.mark.integration

# 1x1 pixel PNG (minimal valid image)
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n"  # PNG signature
    b"\x00\x00\x00\rIHDR"  # IHDR chunk
    b"\x00\x00\x00\x01"  # width=1
    b"\x00\x00\x00\x01"  # height=1
    b"\x08\x02"  # bit depth=8, color type=2 (RGB)
    b"\x00\x00\x00"  # compression, filter, interlace
    b"\x90wS\xde"  # CRC
    b"\x00\x00\x00\x0cIDATx"  # IDAT chunk
    b"\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"  # compressed data
    b"\x00\x00\x00\x00IEND\xaeB`\x82"  # IEND chunk
)


@pytest.fixture(scope="module")
def settings():
    get_settings.cache_clear()
    s = get_settings()
    if not s.cloudinary_api_key:
        pytest.skip("CLOUDINARY_API_KEY não configurado")
    return s


class TestCloudinaryUpload:
    def test_upload_returns_url_and_id(self, settings):
        result = asyncio.get_event_loop().run_until_complete(
            CloudinaryService.upload_file(
                TINY_PNG, user_id="integration-test", folder="test"
            )
        )
        assert "id" in result
        assert "url" in result
        assert result["url"].startswith("https://")
        assert "cloudinary" in result["url"]
        assert "cafe_com_bpo/test/integration-test" in result["id"]

        # Cleanup
        asyncio.get_event_loop().run_until_complete(
            CloudinaryService.delete_file(result["id"])
        )

    def test_upload_to_avatars_folder(self, settings):
        result = asyncio.get_event_loop().run_until_complete(
            CloudinaryService.upload_file(
                TINY_PNG, user_id="integration-test-avatar", folder="avatars"
            )
        )
        assert "cafe_com_bpo/avatars/integration-test-avatar" in result["id"]

        # Cleanup
        asyncio.get_event_loop().run_until_complete(
            CloudinaryService.delete_file(result["id"])
        )

    def test_upload_to_logos_folder(self, settings):
        result = asyncio.get_event_loop().run_until_complete(
            CloudinaryService.upload_file(
                TINY_PNG, user_id="integration-test-logo", folder="logos"
            )
        )
        assert "cafe_com_bpo/logos/integration-test-logo" in result["id"]

        # Cleanup
        asyncio.get_event_loop().run_until_complete(
            CloudinaryService.delete_file(result["id"])
        )

    def test_upload_raw_file_gallery_folder(self, settings):
        """Upload de arquivo não-imagem (raw) para a pasta de galeria."""
        result = asyncio.get_event_loop().run_until_complete(
            CloudinaryService.upload_raw_file(
                b"%PDF-1.4 test raw content",
                user_id="integration-test-gallery",
                folder="gallery",
            )
        )
        assert "id" in result
        assert "url" in result
        assert result["url"].startswith("https://")
        assert "cafe_com_bpo/gallery/integration-test-gallery" in result["id"]

        # Cleanup
        asyncio.get_event_loop().run_until_complete(
            CloudinaryService.delete_file(result["id"])
        )


class TestCloudinaryDelete:
    def test_delete_nonexistent_does_not_raise(self, settings):
        # Should not raise even if file doesn't exist
        asyncio.get_event_loop().run_until_complete(
            CloudinaryService.delete_file("nonexistent-folder/nonexistent-file")
        )
