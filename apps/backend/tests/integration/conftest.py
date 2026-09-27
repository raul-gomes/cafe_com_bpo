"""Conftest para testes de integração.

Força MODE != test (providers reais, sem NoopProvider) durante os testes de
integração e RESTAURA o ambiente ao final da sessão. Sem esse restore, o cache
de settings do conftest raiz fica envenenado com mode != "test", o limiter de
login volta a ativo e todos os testes seguintes da sessão estouram em 429
(cascata de falhas).
"""

import os

import pytest

from src.core.config import get_settings


@pytest.fixture(autouse=True)
def _real_providers_environ():
    """Aplica MODE != test apenas DENTRO de cada teste de integração.

    Escopo por-teste (não session): um fixture de sessão num conftest de
    subpasta só encerraria no fim da suíte inteira, deixando MODE apagado
    (e o rate-limit de login reativo) para todos os testes seguintes da
    sessão — cascata de 429.
    """
    before_mode = os.environ.get("MODE")
    before_db = os.environ.get("DATABASE_URL")

    os.environ.pop("MODE", None)  # providers reais (Resend/Cloudinary)
    get_settings.cache_clear()

    yield

    # Restaura o ambiente para não vazar para o restante da sessão
    if before_mode is None:
        os.environ.pop("MODE", None)
    else:
        os.environ["MODE"] = before_mode
    if before_db is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = before_db
    get_settings.cache_clear()
