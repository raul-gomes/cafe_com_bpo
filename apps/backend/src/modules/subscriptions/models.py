"""Monthly subscription and launch beta program (business rule §17).

Four tables: the plan an admin edits, the subscription mirrored from Asaas, the
saved cards (metadata only) and the beta access granted at launch.

Access is **not** a column: it is derived per request
(`src.core.entitlements`). Storing `is_paid` would create a second state that
drifts from the webhook — exactly the bug §17.7 forbids.
"""

import uuid

from sqlalchemy import (
    UUID,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import relationship

from src.core.database import Base

# Billing cycle. Asaas accepts several (`WEEKLY`…`YEARLY`); the product sells
# monthly, so the value is fixed and never comes from the client.
SUBSCRIPTION_CYCLE_MONTHLY = "MONTHLY"

# Subscription states. Closed set enforced by CHECK: a new state needs a
# migration and code, never a typo.
SUBSCRIPTION_STATUS_ACTIVE = "active"
SUBSCRIPTION_STATUS_PAST_DUE = "past_due"
SUBSCRIPTION_STATUS_CANCELED = "canceled"
SUBSCRIPTION_STATUS_INCOMPLETE = "incomplete"
SUBSCRIPTION_STATUSES = (
    SUBSCRIPTION_STATUS_ACTIVE,
    SUBSCRIPTION_STATUS_PAST_DUE,
    SUBSCRIPTION_STATUS_CANCELED,
    SUBSCRIPTION_STATUS_INCOMPLETE,
)

# Price propagation to Asaas. A new price applies from the next cycle, and the
# subscription records whether Asaas already knows about it.
PRICE_SYNC_SYNCED = "synced"
PRICE_SYNC_PENDING = "pending"
PRICE_SYNC_FAILED = "failed"
PRICE_SYNC_STATUSES = (PRICE_SYNC_SYNCED, PRICE_SYNC_PENDING, PRICE_SYNC_FAILED)

# Origin of the beta grant. Only one exists today (the launch), but the column
# keeps a second program (referral, partnership) auditable.
BETA_SOURCE_LAUNCH = "launch_beta"


class Plan(Base):
    """The plan being sold — the **source of truth for the price** (§17.1).

    Editable only by `role = admin` in the Config tab. No subscription ever
    receives an amount from the browser: billing reads `price` from here.
    """

    __tablename__ = "plans"
    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_plans_price_non_negative"),
        Index("ix_plans_active", "is_active"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(150), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    cycle = Column(
        String(20), nullable=False, server_default=SUBSCRIPTION_CYCLE_MONTHLY
    )
    is_active = Column(Boolean, nullable=False, server_default="true")
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Subscription(Base):
    """Local mirror of a recurring subscription in Asaas.

    Asaas owns the state; this row is the auditable record answering "what did
    this user pay". The webhook is what keeps it updated.

    A canceled subscription frees the user to subscribe again, so uniqueness is
    **partial**: only non-canceled subscriptions are unique per user.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'past_due', 'canceled', 'incomplete')",
            name="ck_subscriptions_status",
        ),
        CheckConstraint("price >= 0", name="ck_subscriptions_price_non_negative"),
        CheckConstraint(
            "price_sync_status IN ('synced', 'pending', 'failed')",
            name="ck_subscriptions_price_sync_status",
        ),
        # One live subscription per person: the index is partial on purpose,
        # otherwise the canceled history would break uniqueness.
        Index(
            "uq_subscriptions_open_per_user",
            "user_id",
            unique=True,
            sqlite_where=text("status != 'canceled'"),
            postgresql_where=text("status != 'canceled'"),
        ),
        Index("ix_subscriptions_user_status", "user_id", "status"),
        Index("ix_subscriptions_asaas_id", "asaas_subscription_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    plan_id = Column(
        UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False
    )

    status = Column(
        String(20), nullable=False, server_default=SUBSCRIPTION_STATUS_ACTIVE
    )
    cycle = Column(
        String(20), nullable=False, server_default=SUBSCRIPTION_CYCLE_MONTHLY
    )
    # Price of the current cycle. It changes when an admin edits the plan (§17.1),
    # while what was actually charged stays in `payments.cycle_month`.
    price = Column(Numeric(12, 2), nullable=False)

    asaas_customer_id = Column(String(100), nullable=True)
    asaas_subscription_id = Column(String(100), nullable=True, unique=True)

    # Período já pago. `current_period_end` é o que segura o acesso depois de um
    # cancelamento (§17.5).
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    # Vencimento + 3 dias de tolerância (§17.4).
    grace_until = Column(DateTime(timezone=True), nullable=True)
    next_billing_date = Column(DateTime(timezone=True), nullable=True)

    canceled_at = Column(DateTime(timezone=True), nullable=True)
    cancel_reason = Column(Text, nullable=True)

    price_sync_status = Column(
        String(20), nullable=False, server_default=PRICE_SYNC_PENDING
    )
    price_synced_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    plan = relationship("Plan", lazy="joined")
    user = relationship("User", foreign_keys=[user_id])


class PaymentMethod(Base):
    """Saved card — **only what the screen shows** (§17.2).

    Number, CVV and token live in Asaas and are never stored here. What stays is
    the card id there, the brand, the last 4 digits, the expiry and the holder.
    """

    __tablename__ = "payment_methods"
    __table_args__ = (
        Index("ix_payment_methods_user", "user_id"),
        # One default card per user: the partial index enforces it without
        # blocking a switch (switching the default is an UPDATE of both rows).
        Index(
            "uq_payment_methods_default_per_user",
            "user_id",
            unique=True,
            sqlite_where=text("is_default = true"),
            postgresql_where=text("is_default = true"),
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    asaas_card_id = Column(String(100), nullable=False)
    brand = Column(String(50), nullable=True)
    last4 = Column(String(4), nullable=True)
    expiry_month = Column(String(2), nullable=True)
    expiry_year = Column(String(4), nullable=True)
    holder_name = Column(String(150), nullable=True)
    is_default = Column(Boolean, nullable=False, server_default="false")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class BetaAccess(Base):
    """One-year beta access granted at launch (§17.6).

    The expiry is stored **per row** and never changes: it is the record of what
    the person was granted. Re-running the grant neither extends the term nor
    duplicates a row.
    """

    __tablename__ = "beta_access"
    __table_args__ = (Index("ix_beta_access_expires", "expires_at"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    granted_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at = Column(DateTime(timezone=True), nullable=False)
    source = Column(String(50), nullable=False, server_default=BETA_SOURCE_LAUNCH)
    granted_by = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)


__all__ = [
    "BETA_SOURCE_LAUNCH",
    "PRICE_SYNC_FAILED",
    "PRICE_SYNC_PENDING",
    "PRICE_SYNC_STATUSES",
    "PRICE_SYNC_SYNCED",
    "SUBSCRIPTION_CYCLE_MONTHLY",
    "SUBSCRIPTION_STATUSES",
    "SUBSCRIPTION_STATUS_ACTIVE",
    "SUBSCRIPTION_STATUS_CANCELED",
    "SUBSCRIPTION_STATUS_INCOMPLETE",
    "SUBSCRIPTION_STATUS_PAST_DUE",
    "BetaAccess",
    "PaymentMethod",
    "Plan",
    "Subscription",
]
