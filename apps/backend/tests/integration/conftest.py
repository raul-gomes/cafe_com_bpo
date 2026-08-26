"""Conftest para testes de integração.

Limpa o cache de settings e configura o ambiente para usar credenciais reais.
NÃO usa banco de dados — testa apenas provider e storage service diretamente.
"""

import os

# Limpar variáveis que o conftest raiz pode ter setado ANTES de qualquer import
_original_mode = os.environ.get("MODE")
_original_db = os.environ.get("DATABASE_URL")

# Forçar MODE != test para que os providers não sejam substituídos por NoopProvider
if os.environ.get("MODE") == "test":
    del os.environ["MODE"]

from src.core.config import get_settings  # noqa: E402


def pytest_runtest_setup(item):
    """Limpa cache de settings antes de cada teste de integração."""
    get_settings.cache_clear()
    # Garantir que MODE não é 'test'
    if os.environ.get("MODE") == "test":
        del os.environ["MODE"]
