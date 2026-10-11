"""Regressão: a suíte padrão não pode chamar APIs reais nem exigir um banco real.

`tests/integration/` é marcado com `pytest.mark.integration` porque faz
upload real no Cloudinary, envio real de e-mail pelo Resend e — desde o
rehearsal da Fase 2.1 — roda a cadeia de migrations em um PostgreSQL real (a
primeira revision já declara uma coluna `ARRAY`, então `alembic upgrade` nem
compila em SQLite).

Sem `-m "not integration"` no `addopts`, um `pytest` puro coletava esses
arquivos e o CI quebrava (credenciais dummy passavam no guard e a API real
respondia `cloud_name is disabled`), enquanto o run local do desenvolvedor
atingia a rede de verdade.

Um teste que depende da rede ou de um servidor externo não é determinístico — a
regra do AGENTS.md proíbe isso. A correção é de configuração, não de código de
produção, então o teste trava a configuração. O mesmo vale para o workflow: sem
o serviço `postgres`, a garantia da Fase 2.1 simplesmente não existe em lugar
nenhum e nada quebraria para avisar.
"""

import configparser
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PYTEST_INI = BACKEND_ROOT / "pytest.ini"


def _repo_root() -> Path | None:
    """Finds the checkout root, or `None` when only the backend was mounted.

    The test container bind-mounts just `apps/backend`, so the workflow is not
    reachable from there; the check that needs it skips instead of failing.

    Returns:
        The directory holding `.github/workflows`, or `None`.
    """
    for candidate in BACKEND_ROOT.parents:
        if (candidate / ".github" / "workflows").is_dir():
            return candidate
    return None


MIGRATION_REHEARSAL = "tests/integration/test_migrations_postgres.py"


def _addopts() -> str:
    parser = configparser.ConfigParser()
    parser.read(PYTEST_INI)
    return parser.get("pytest", "addopts", fallback="")


def test_default_run_deselects_integration_marker():
    assert '-m "not integration"' in _addopts(), (
        'pytest.ini precisa de addopts = -m "not integration": sem isso a '
        "suíte padrão executa testes de integração que chamam Cloudinary e "
        "Resend reais (e o CI quebra com credenciais dummy)"
    )


def test_integration_still_runnable_explicitly():
    """`pytest -m integration` na linha de comando continua prevalecendo."""
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-m",
            "integration",
            "--collect-only",
            "-q",
            "tests/integration",
        ],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "test_api_projects_mine" not in result.stdout
    assert "tests/integration/test_cloudinary.py::TestCloudinaryUpload" in result.stdout


def test_default_run_collects_no_integration_test():
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "tests/integration"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 5, result.stdout + result.stderr


def test_the_migration_rehearsal_is_opt_in() -> None:
    """O rehearsal exige PostgreSQL, então precisa do marcador `integration`.

    Sem o `pytestmark`, um `pytest` na máquina do desenvolvedor (ou no job padrão
    do CI) passa a exigir um servidor de banco e falha na coleta.
    """
    source = (BACKEND_ROOT / MIGRATION_REHEARSAL).read_text(encoding="utf-8")
    assert "pytestmark = pytest.mark.integration" in source, (
        f"{MIGRATION_REHEARSAL} precisa de `pytestmark = pytest.mark.integration`: "
        "ele cria e destrói bancos em um PostgreSQL real"
    )


def test_the_workflow_runs_the_migration_rehearsal_against_postgres() -> None:
    """O CI precisa ter o serviço `postgres` e rodar o rehearsal.

    É o único lugar onde a premissa da Fase 2.1 é verificada de verdade: se
    alguém remover o job, nenhuma suíte local avisa — a garantia da §2.1
    desapareceria em silêncio.
    """
    repo_root = _repo_root()
    if repo_root is None:
        pytest.skip("only apps/backend is mounted: the CI workflow is not reachable")

    workflow = (repo_root / ".github" / "workflows" / "main.yml").read_text(
        encoding="utf-8"
    )
    assert "postgres:16-alpine" in workflow, (
        "main.yml precisa do serviço postgres: a cadeia de migrations usa "
        "colunas ARRAY e não roda em SQLite"
    )
    assert MIGRATION_REHEARSAL in workflow, (
        f"main.yml precisa rodar {MIGRATION_REHEARSAL}: é o que prova B1/B2/B3 e "
        "V1-V5 sobre uma cópia com a forma de produção"
    )
    gate = workflow.split("\n  ci-passed:")[1].split("\n  build-and-push:")[0]
    assert "migration-ci" in gate, (
        "o gate de CI precisa depender de `migration-ci`, senão o deploy "
        "acontece com o rehearsal vermelho"
    )
