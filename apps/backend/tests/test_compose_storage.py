"""AUD-012: uploaded files survive a container rebuild in the versioned stack.

Private gallery files, avatars and logos saved on disk live in /app/storage. The
production compose must mount a named volume there, or every deploy (a new
container) drops the files while the database rows keep pointing at them.

The check reads the compose text (no YAML dependency, no Docker in CI), like the
`.dockerignore` regression; the proof on a real stack is to upload, recreate the
api container and download again, done by hand when this changes.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
COMPOSE = REPO_ROOT / "docker-compose.yml"
DOCKERFILE = Path(__file__).resolve().parents[1] / "Dockerfile"


def _service_block(text: str, name: str) -> str:
    """Returns the lines of one top-level compose service.

    Args:
        text: Whole compose file.
        name: Service name.

    Returns:
        The service block, up to the next service or top-level key.
    """
    match = re.search(
        rf"^  {name}:\n(.*?)(?=^  \S|^\S)", text, re.DOTALL | re.MULTILINE
    )
    assert match, f"service {name} not found in docker-compose.yml"
    return match.group(1)


def test_api_mounts_a_named_volume_on_storage():
    text = COMPOSE.read_text(encoding="utf-8")
    api = _service_block(text, "api")
    mount = re.search(r"^\s+- (\w+):/app/storage\s*$", api, re.MULTILINE)
    assert mount, "api must mount a named volume on /app/storage"
    top_volumes = text.split("\nvolumes:\n", 1)[1]
    assert re.search(rf"^  {mount.group(1)}:", top_volumes, re.MULTILINE), (
        f"volume {mount.group(1)} must be declared under the top-level volumes"
    )


def test_image_creates_storage_owned_by_the_app_user():
    """A named volume copies the image's ownership on first mount."""
    text = DOCKERFILE.read_text(encoding="utf-8")
    assert "/app/storage" in text
    assert "chown -R 1001:1001 /app" in text
