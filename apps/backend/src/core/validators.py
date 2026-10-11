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


# --- Billing data (§17.8) -----------------------------------------------------
# The Asaas Checkout refuses to open without a document and a phone number, and
# it refuses a phone that is not digits only — answering "o campo phoneNumber
# deve ser informado", which blames a missing field for a formatting problem.
# Normalizing here is what keeps that message away from the user.

# Repeating digits ("11111111111") survive a naive check-digit test, so they are
# rejected explicitly: they are what people type to get past a form.
_REPEATED_DIGITS = re.compile(r"^(\d)\1+$")


def _check_digit(digits: str, weights: tuple[int, ...]) -> int:
    """Computes one check digit of a CPF or CNPJ.

    Args:
        digits: The digits preceding the check digit.
        weights: Weights applied left to right, cycling when they run out.

    Returns:
        The check digit, from 0 to 9.
    """
    total = sum(
        int(digit) * weight for digit, weight in zip(digits, weights * 2, strict=False)
    )
    remainder = total % 11
    return 0 if remainder < 2 else 11 - remainder


def _cpf_is_valid(digits: str) -> bool:
    """Checks a CPF's two check digits.

    Args:
        digits: Eleven digits.

    Returns:
        Whether the document is consistent.
    """
    for size in range(9, 11):
        if digits[size] != str(
            _check_digit(digits[:size], tuple(range(size + 1, 1, -1)))
        ):
            return False
    return True


def _cnpj_is_valid(digits: str) -> bool:
    """Checks a CNPJ's two check digits.

    Args:
        digits: Fourteen digits.

    Returns:
        Whether the document is consistent.
    """
    for size, weights in (
        (12, (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)),
        (13, (6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)),
    ):
        if digits[size] != str(_check_digit(digits[:size], weights)):
            return False
    return True


def validate_document(value: str | None) -> str | None:
    """Validates and normalizes a CPF or a CNPJ for billing.

    Deliberately stricter than `validate_cnpj`: that one only strips characters
    because the registration form has always been permissive and changing it
    would reject people mid-signup. Here an invalid document would only surface
    when the provider validates it at payment confirmation, with the user looking
    at a screen that says the payment went through — an expensive and confusing
    failure. §17.8 makes the check digit a form error.

    Args:
        value: The document as typed, with or without punctuation.

    Returns:
        The digits only, or `None` when nothing was sent.

    Raises:
        ValueError: When the document is neither a valid CPF nor a valid CNPJ.
    """
    if value is None or not str(value).strip():
        return None

    digits = _only_digits(value)
    if _REPEATED_DIGITS.match(digits):
        raise ValueError("Informe um CPF ou CNPJ válido")

    if len(digits) == 11 and _cpf_is_valid(digits):
        return digits
    if len(digits) == 14 and _cnpj_is_valid(digits):
        return digits
    raise ValueError("Informe um CPF ou CNPJ válido")


def validate_phone(value: str | None) -> str | None:
    """Normalizes a phone number to digits only, without the country code.

    §17.8: the Asaas Checkout rejects a masked number with an error that says the
    field is missing. Stripping punctuation here turns "+55 (47) 3801-0919" into
    the "4738010919" the provider accepts.

    Args:
        value: The phone as typed.

    Returns:
        Ten or eleven digits (DDD plus number), or `None` when nothing was sent.

    Raises:
        ValueError: When the number has no plausible Brazilian length.
    """
    if value is None or not str(value).strip():
        return None

    digits = _only_digits(value)
    if digits.startswith("55") and len(digits) in (12, 13):
        digits = digits[2:]

    if len(digits) not in (10, 11) or _REPEATED_DIGITS.match(digits):
        raise ValueError("Informe um telefone válido com DDD")

    return digits


def validate_postal_code(value: str | None) -> str | None:
    """Normalizes a postal code to the eight digits the column stores.

    Kept apart from `validate_cep`, which deliberately returns the address as
    typed because the prospect and client screens show it that way. Here the value
    is a machine key that Asaas and the column both expect without the dash, and a
    masked one is nine characters in an eight-wide column.

    Args:
        value: The postal code as typed.

    Returns:
        Eight digits, or `None` when nothing was sent.

    Raises:
        ValueError: When the code does not have eight digits.
    """
    if value is None or not str(value).strip():
        return None

    digits = _only_digits(value)
    if len(digits) != 8:
        raise ValueError("Informe um CEP válido")
    return digits
