"""Regressão do contexto de build da imagem do backend (SEC-4).

O Dockerfile faz `COPY . .` e o contexto é `./apps/backend`. Sem `.dockerignore`,
tudo que existe naquela pasta entra na imagem que vai para o GHCR — inclusive um
`.env` com `JWT_SECRET`, credenciais do Google, senha do Postgres e chaves de
Asaas/Resend. Um `.dockerignore` ausente é falha silenciosa: o build funciona,
a imagem fica "ok" e o segredo está lá dentro.

O teste é sobre o arquivo de regras, não sobre um build (build no CI seria lento
e exigiria Docker). A prova de que a imagem ficou limpa é `docker compose build
api` + inspeção, feita à mão quando o `.dockerignore` muda.
"""

from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
DOCKERIGNORE = BACKEND_DIR / ".dockerignore"

# O que a imagem precisa ter para o container subir e rodar as migrations.
REQUIRED_AT_RUNTIME = (
    "src",
    "alembic",
    "alembic.ini",
    "entrypoint.sh",
    "requirements.txt",
)


@pytest.fixture(scope="module")
def rules() -> list[str]:
    """Reads the ignore rules, ignoring comments and blank lines.

    Returns:
        The list of patterns in the `.dockerignore`.
    """
    if not DOCKERIGNORE.exists():
        pytest.fail(
            "apps/backend/.dockerignore não existe: o `COPY . .` do Dockerfile "
            "embala o .env e o venv de teste na imagem publicada"
        )
    return [
        line.strip()
        for line in DOCKERIGNORE.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]


def test_env_file_is_excluded(rules):
    """The regression: the .env must never reach the image."""
    assert ".env" in rules
    assert ".env.*" in rules, "variantes como .env.local também entram"


def test_test_venv_and_caches_are_excluded(rules):
    """`temp_test_venv` alone was hundreds of MB inside the image."""
    assert "temp_test_venv/" in rules
    assert ".pytest_cache/" in rules
    assert ".ruff_cache/" in rules
    assert "__pycache__/" in rules


def test_tests_are_not_shipped(rules):
    """The production image has no pytest; the suite runs in CI."""
    assert "tests/" in rules


def test_runtime_paths_are_not_excluded(rules):
    """Guard against an over-broad ignore breaking the container.

    Excluding `src/` or `alembic/` would make the image start and then fail on
    the first import or on `alembic upgrade head`.
    """
    ignored_roots = {rule.rstrip("/") for rule in rules}
    for path in REQUIRED_AT_RUNTIME:
        assert path not in ignored_roots, f"{path} é necessário em runtime"


def test_leftover_nested_apps_dir_is_excluded(rules):
    """`apps/backend/apps/backend` exists in the tree with no file in it."""
    assert "apps/" in rules


def test_git_is_excluded(rules):
    """A `.git` dentro da imagem vaza histórico e aumenta o build."""
    assert ".git/" in rules


def test_dockerfile_copy_still_depends_on_the_context():
    """Documents the coupling: the fix only works while the copy is `COPY . .`.

    If the Dockerfile ever copies explicit paths, this test is the reminder that
    the `.dockerignore` still has to be reviewed.
    """
    dockerfile = (BACKEND_DIR / "Dockerfile").read_text(encoding="utf-8")
    assert "COPY --chown=1001:1001 . ." in dockerfile
