"""AUD-030: the webhook secrets reach the api container.

Both provider webhooks fail closed: without their secret the API refuses every
event. The compose lists each variable the api receives, so a secret missing
there is never seen by the app, even when it is set in the server's .env; the
e-mail webhook then rejected every Resend event in production.

The check reads the compose text (no YAML dependency, no Docker in CI).
"""

import re

import pytest

from tests.test_compose_storage import COMPOSE, REPO_ROOT, _service_block

ENV_EXAMPLE = REPO_ROOT / ".env.example"

WEBHOOK_SECRETS = ["RESEND_WEBHOOK_SECRET", "ASAAS_WEBHOOK_TOKEN"]


@pytest.mark.parametrize("name", WEBHOOK_SECRETS)
def test_api_receives_the_webhook_secret(name):
    api = _service_block(COMPOSE.read_text(encoding="utf-8"), "api")
    assert re.search(rf"^\s+- {name}=\$\{{{name}\}}\s*$", api, re.MULTILINE), (
        f"api must receive {name} from the environment"
    )


@pytest.mark.parametrize("name", WEBHOOK_SECRETS)
def test_env_example_documents_the_webhook_secret(name):
    text = ENV_EXAMPLE.read_text(encoding="utf-8")
    assert re.search(rf"^{name}=", text, re.MULTILINE), f"{name} missing"
