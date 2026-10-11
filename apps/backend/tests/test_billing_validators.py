"""Document and phone normalization for the billing data of §17.8.

These two rules were written down after the sandbox refused a checkout that the
product considered valid, so each test pins a failure that really happened:

- A masked phone is refused by Asaas with *"o campo phoneNumber deve ser
  informado"* — a message that blames a missing field for a formatting problem.
- A CPF whose check digit is wrong is accepted by our registration form and only
  rejected by the provider when the payment is confirmed, with the user looking
  at a screen that says the payment went through.
"""

import pytest

from src.core.validators import (
    validate_document,
    validate_phone,
    validate_postal_code,
)


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        ("4738010919", "4738010919"),
        ("(47) 3801-0919", "4738010919"),
        ("+55 (47) 3801-0919", "4738010919"),
        ("554738010919", "4738010919"),
        (" 47 3801 0919 ", "4738010919"),
        ("11987654321", "11987654321"),
        ("1198765-4321", "11987654321"),
    ],
)
def test_the_phone_reaches_the_provider_as_digits(typed, expected):
    """Masked, punctuated and country-coded input all become plain digits.

    Args:
        typed: What the user typed.
        expected: What the Asaas Checkout accepts.
    """
    assert validate_phone(typed) == expected


@pytest.mark.parametrize("typed", ["1234", "123456789", "123456789012", "00000000000"])
def test_an_unusable_phone_is_refused_with_a_message_the_user_can_act_on(typed):
    """A wrong length or a repeated digit is a form error, not a provider 400.

    Args:
        typed: What the user typed.
    """
    with pytest.raises(ValueError, match="telefone"):
        validate_phone(typed)


def test_an_empty_phone_is_not_an_error():
    """Optional stays optional.

    Returns:
        None. Raises `AssertionError` when the value is not `None`.
    """
    assert validate_phone(None) is None
    assert validate_phone("   ") is None


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        ("24971563792", "24971563792"),
        ("249.715.637-92", "24971563792"),
        # A CNPJ, because a company can be the payer.
        ("11222333000181", "11222333000181"),
        ("11.222.333/0001-81", "11222333000181"),
    ],
)
def test_a_valid_document_becomes_digits(typed, expected):
    """Punctuation is dropped, the digits are kept.

    Args:
        typed: What the user typed.
        expected: The digits sent to the provider.
    """
    assert validate_document(typed) == expected


@pytest.mark.parametrize(
    "typed",
    [
        "24971563793",  # last digit wrong
        "11111111111",  # passes a naive check digit test
        "12345678901",
        "11222333000182",  # CNPJ with a wrong check digit
    ],
)
def test_a_document_that_fails_its_check_digit_is_refused(typed):
    """The provider would only complain at payment confirmation; we complain now.

    Args:
        typed: A document whose check digit does not add up.
    """
    with pytest.raises(ValueError, match="CPF ou CNPJ"):
        validate_document(typed)


@pytest.mark.parametrize("typed", ["", "   ", None])
def test_an_empty_document_is_none_not_an_error(typed):
    """Optional stays optional; the schema decides whether it is required.

    Args:
        typed: What the user typed.
    """
    assert validate_document(typed) is None


@pytest.mark.parametrize(
    ("typed", "expected"),
    [("01310-000", "01310000"), ("01310000", "01310000"), (" 01310 000 ", "01310000")],
)
def test_the_postal_code_reaches_the_column_as_eight_digits(typed, expected):
    """SQLite accepts `01310-000` in a `varchar(8)`; PostgreSQL truncates and fails.

    The column is eight wide because that is a Brazilian CEP without the dash, and
    the dash form is what people type and what an autofill pastes.

    Args:
        typed: What the user typed.
        expected: The eight digits stored.
    """
    assert validate_postal_code(typed) == expected


@pytest.mark.parametrize("typed", ["0131-000", "0131000", "abc"])
def test_a_postal_code_that_is_not_eight_digits_is_refused(typed):
    """A truncated address reaches the provider and fails the payment.

    Args:
        typed: What the user typed.
    """
    with pytest.raises(ValueError, match="CEP"):
        validate_postal_code(typed)
