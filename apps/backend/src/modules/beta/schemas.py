from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Profile = Literal["starting", "growing", "accounting_office", "other"]
ClientRange = Literal["0", "1-5", "6-15", "16-30", "30+"]


class BetaSignupCreate(BaseModel):
    """Public Beta signup payload sent by the landing page form."""

    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    whatsapp: str | None = Field(None, max_length=30)
    profile: Profile
    client_range: ClientRange
    challenge: str | None = Field(None, max_length=1000)
    source: str | None = Field(None, max_length=100)
    lgpd_consent: bool
    # Honeypot: invisible to people, filled by bots.
    website: str | None = Field(None, max_length=200)

    @field_validator("name", "challenge", "source", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        """Trims surrounding spaces of free-text fields.

        Args:
            value: Raw field value.

        Returns:
            The trimmed string, or the value untouched when it is not a string.
        """
        return value.strip() if isinstance(value, str) else value

    @field_validator("email", mode="after")
    @classmethod
    def _lower_email(cls, value: str) -> str:
        """Normalizes the e-mail so one person maps to one row.

        Args:
            value: Validated e-mail.

        Returns:
            The lowercase e-mail.
        """
        return value.lower()

    @field_validator("whatsapp", mode="after")
    @classmethod
    def _digits_only(cls, value: str | None) -> str | None:
        """Keeps only the digits of the WhatsApp number.

        Args:
            value: Number as typed (may contain spaces, dashes, parentheses).

        Returns:
            The digits, or `None` when nothing was typed.

        Raises:
            ValueError: When the number has no area code.
        """
        if value is None:
            return None
        digits = "".join(ch for ch in value if ch.isdigit())
        if digits and not 10 <= len(digits) <= 13:
            raise ValueError("WhatsApp deve ter DDD e número.")
        return digits or None

    @field_validator("lgpd_consent")
    @classmethod
    def _must_consent(cls, value: bool) -> bool:
        """Rejects the signup without explicit LGPD consent.

        Args:
            value: Whether the person ticked the consent box.

        Returns:
            The value, when `True`.

        Raises:
            ValueError: When consent was not given.
        """
        if not value:
            raise ValueError("É preciso aceitar o uso dos dados (LGPD).")
        return value


class BetaSignupAccepted(BaseModel):
    """Same answer for a new, repeated or bot signup: it reveals nothing."""

    message: str = "Inscrição recebida. Em breve a gente fala com você."


class BetaSignupResponse(BaseModel):
    """A signup as shown on the admin "Inscrições Beta" page."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    email: str
    whatsapp: str | None
    profile: str
    client_range: str
    challenge: str | None
    signed_up_at: datetime = Field(validation_alias="created_at")
