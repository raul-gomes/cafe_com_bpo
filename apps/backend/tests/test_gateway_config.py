"""AUD-028 / AUD-038: the gateway lets the app's uploads through, in both stacks.

Nginx refuses bodies over 1 MB by default, so a 5 MB PDF in the gallery or a
task attachment died at the gateway with an HTML 413 the screen cannot read,
long before the API's own 10/20 MB checks. The dev compose also built the
gateway from `nginx.conf.local`, a file that did not exist in the repository.

The check reads the config text (no Nginx in CI), like the compose regression.
"""

import re
from pathlib import Path

from src.modules.gallery.router import MAX_FILE_SIZE
from src.modules.task_manager.attachments.router import FILE_UPLOAD_MAX_SIZE

REPO_ROOT = Path(__file__).resolve().parents[3]
INFRA = REPO_ROOT / "infra"
DEV_COMPOSE = REPO_ROOT / "docker-compose.dev.yml"

_UNITS = {"": 1, "k": 1024, "m": 1024**2, "g": 1024**3}


def _body_limit(conf: str) -> int:
    """Returns the http-level client_max_body_size of an Nginx config, in bytes.

    Args:
        conf: Whole config text.

    Returns:
        The limit in bytes (Nginx's 1 MB default when the directive is absent).
    """
    match = re.search(r"^\s*client_max_body_size\s+(\d+)([kmgKMG]?);", conf, re.M)
    if not match:
        return 1024**2
    return int(match.group(1)) * _UNITS[match.group(2).lower()]


def _dev_conf_name() -> str:
    """Returns the Nginx config file the dev compose builds the gateway with."""
    match = re.search(r"NGINX_CONF:\s*(\S+)", DEV_COMPOSE.read_text(encoding="utf-8"))
    assert match, "docker-compose.dev.yml must pick the gateway config"
    return match.group(1)


def test_dev_compose_gateway_config_exists():
    assert (INFRA / _dev_conf_name()).is_file()


def test_gateway_accepts_the_largest_upload_the_api_allows():
    largest = max(MAX_FILE_SIZE, FILE_UPLOAD_MAX_SIZE)
    for name in ("nginx.conf", _dev_conf_name()):
        path = INFRA / name
        assert path.is_file(), f"{name} missing"
        limit = _body_limit(path.read_text(encoding="utf-8"))
        # Room for the multipart envelope around the file.
        assert limit > largest, f"{name}: client_max_body_size below {largest}"
