"""
Validators and formatters shared across modules.

Centralizes business validation helpers to avoid duplication (CNPJ, CEP, etc.)
and to provide a single source of truth for data normalization.
"""

import re


def _only_digits(value: str | None) -> str:
    """Return the string with all non-digit characters removed."""
    if not value:
        return ""
    return re.sub(r"\D", "", value)


def validate_cnpj(value: str | None) -> str | None:
    """Validate and normalize a Brazilian CNPJ.

    Normalizes by stripping non-digit characters. Returns the normalized
    digit string if non-empty, otherwise raises ValueError.

    Behavior kept permissive to match existing schema validations in the
    codebase (which only require non-empty digits after stripping).
    """
    if value is None or value == "":
        return None

    digits = _only_digits(value)
    if not digits:
        raise ValueError("Informe um CNPJ válido")

    return digits


def validate_cep(value: str | None) -> str | None:
    """Validate and normalize a Brazilian CEP.

    Preserves the original format when possible (formatted 00000-000 or
    plain 8-digit strings). Returns the value as-is if it contains 8 digits
    total (allowing a dash in position 5), otherwise raises ValueError.
    """
    if value is None or value == "":
        return None

    if not isinstance(value, str):
        value = str(value)

    # Count digits
    digits = _only_digits(value)
    if len(digits) != 8:
        raise ValueError("CEP inválido")

    # Preserve original format if it was formatted as 00000-000
    # or if it's just 8 digits - return as provided (trimmed)
    # But we need to be consistent with how it's stored
    # The test expects the formatted version preserved as sent
    return value.strip() if hasattr(value, "strip") else value
