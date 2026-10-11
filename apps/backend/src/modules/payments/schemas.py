"""Response schemas of the payments module — the API contract of the screen (§6)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BillingHistoryRow(BaseModel):
    """One billing entry as the payments screen renders it, month by month (§17.2).

    Purpose-built and never the ORM: six keys, because six things show on the
    screen — the cycle month, the value, the state of the charge, when it was
    paid, the invoice link and the row id the list keys on. `amount` ships as
    text on purpose: money is formatted by the screen, and a JSON float would
    arrive as `27.899999999999998` for anyone who rendered it directly.
    """

    id: UUID
    cycle_month: str | None
    amount: str
    status: str
    paid_at: datetime | None
    invoice_url: str | None
