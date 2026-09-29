"""Regressão: a suíte padrão não pode chamar APIs reais.

`tests/integration/` é marcado com `pytest.mark.integration` porque faz
upload real no Cloudinary e envio real de e-mail pelo Resend. Sem
`-m "not integration"` no `addopts`, um `pytest` puro coletava esses
arquivos e o CI quebrava (credenciais dummy passavam no guard e a API
real respondia `cloud_name is disabled`), enquanto o run local do
desenvolvedor atingia a rede de verdade.

Um teste que depende da rede não é determinístico — a regra do AGENTS.md
proíbe isso. A correção é de configuração, não de código de produção,
então o teste trava a configuração.
"""

import configparser
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PYTEST_INI = BACKEND_ROOT / "pytest.ini"


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
