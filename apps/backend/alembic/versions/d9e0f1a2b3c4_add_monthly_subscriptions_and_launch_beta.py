"""add monthly subscriptions, saved cards and the launch beta (Business rule §17)

Phase 1 of `docs/plano-pagamentos.md`. Four tables arrive together because they
are one decision split in parts:

- `plans`: the price the platform sells. §17.1 makes the **database** the source
  of truth — no subscription ever receives an amount from the browser — so the
  R$ 27.90 monthly plan is seeded here, once, idempotently by `code`.
- `subscriptions`: the local mirror of the Asaas recurring subscription. Access
  is derived from this table per request, never from a stored `is_paid` flag,
  because two sources of truth drift (§17.7). Uniqueness is **partial**: a
  canceled subscription frees the user to subscribe again, so only non-canceled
  rows are unique per user.
- `payment_methods`: card metadata the screen shows (§17.2). The number, the CVV
  and the token stay in Asaas; the columns that would hold them are absent by
  design, and a structural test fails the day someone adds one back.
- `beta_access`: the one-year beta granted at launch (§17.6). The expiry is
  stored per row and never moves, so re-running the grant is idempotent.

`payments` gains the cycle columns that make a "paid month" answerable
(`cycle_month`, `paid_at`, the receipt link and the card used) and its `amount`
becomes `NUMERIC(12,2)`: a monthly sum is money the user checks on the screen,
and `FLOAT` cannot represent 0.10 + 0.20 exactly (§15 follows the same
doctrine). The cast is explicit (`amount::numeric`) because Postgres will not
narrow `DOUBLE PRECISION` to `NUMERIC` on its own.

The beta rows are **not** seeded here: the launch date is decided on the day, so
the grant runs as an explicit command (`python -m src.modules.subscriptions.beta
--grant --start YYYY-MM-DD`) instead of being frozen in history.

Nothing in this revision is destructive on upgrade: every change is additive and
the `NUMERIC` cast preserves the amount of existing one-off payments.

Revision ID: d9e0f1a2b3c4
Revises: e9f0a1b2c3d4
Create Date: 2026-10-05

"""

from collections.abc import Sequence
from decimal import Decimal

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9e0f1a2b3c4"
down_revision: str | Sequence[str] | None = "e9f0a1b2c3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Seeded monthly plan. `code` is the business key (unique), `name` is UI copy and
# therefore stays in the product language (§7).
SEEDED_PLAN_CODE = "monthly"
SEEDED_PLAN_NAME = "Mensal"
# `Decimal`, not `str`: a bound string arrives at the numeric column as
# VARCHAR and Postgres refuses the cast.
SEEDED_PLAN_PRICE = Decimal("27.90")


def upgrade() -> None:
    """Create the subscription tables and extend `payments` with the cycle."""
    op.create_table(
        "plans",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "cycle", sa.String(length=20), server_default="MONTHLY", nullable=False
        ),
        sa.Column(
            "is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("price >= 0", name="ck_plans_price_non_negative"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )
    op.create_index("ix_plans_active", "plans", ["is_active"], unique=False)

    op.create_table(
        "beta_access",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column(
            "granted_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "source",
            sa.String(length=50),
            server_default="launch_beta",
            nullable=False,
        ),
        sa.Column("granted_by", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "ix_beta_access_expires", "beta_access", ["expires_at"], unique=False
    )

    op.create_table(
        "payment_methods",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("asaas_card_id", sa.String(length=100), nullable=False),
        sa.Column("brand", sa.String(length=50), nullable=True),
        sa.Column("last4", sa.String(length=4), nullable=True),
        sa.Column("expiry_month", sa.String(length=2), nullable=True),
        sa.Column("expiry_year", sa.String(length=4), nullable=True),
        sa.Column("holder_name", sa.String(length=150), nullable=True),
        sa.Column(
            "is_default",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_payment_methods_user", "payment_methods", ["user_id"], unique=False
    )
    # Partial index: one default card per user without blocking a switch, which is
    # an UPDATE of the two rows involved.
    op.create_index(
        "uq_payment_methods_default_per_user",
        "payment_methods",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("plan_id", sa.UUID(), nullable=False),
        sa.Column(
            "status", sa.String(length=20), server_default="active", nullable=False
        ),
        sa.Column(
            "cycle", sa.String(length=20), server_default="MONTHLY", nullable=False
        ),
        sa.Column("price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("asaas_customer_id", sa.String(length=100), nullable=True),
        sa.Column("asaas_subscription_id", sa.String(length=100), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_billing_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.Text(), nullable=True),
        sa.Column(
            "price_sync_status",
            sa.String(length=20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column("price_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        # Closed set of states, so a new one needs a migration instead of arriving
        # as a typo from a webhook payload.
        sa.CheckConstraint(
            "status IN ('active', 'past_due', 'canceled', 'incomplete')",
            name="ck_subscriptions_status",
        ),
        sa.CheckConstraint("price >= 0", name="ck_subscriptions_price_non_negative"),
        sa.CheckConstraint(
            "price_sync_status IN ('synced', 'pending', 'failed')",
            name="ck_subscriptions_price_sync_status",
        ),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("asaas_subscription_id"),
    )
    op.create_index(
        "ix_subscriptions_asaas_id",
        "subscriptions",
        ["asaas_subscription_id"],
        unique=False,
    )
    op.create_index(
        "ix_subscriptions_user_status",
        "subscriptions",
        ["user_id", "status"],
        unique=False,
    )
    # One live subscription per person; the canceled history stays auditable.
    op.create_index(
        "uq_subscriptions_open_per_user",
        "subscriptions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status != 'canceled'"),
    )

    op.add_column("payments", sa.Column("subscription_id", sa.UUID(), nullable=True))
    op.add_column(
        "payments", sa.Column("cycle_month", sa.String(length=7), nullable=True)
    )
    op.add_column(
        "payments", sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "payments", sa.Column("invoice_url", sa.String(length=500), nullable=True)
    )
    op.add_column(
        "payments", sa.Column("credit_card_brand", sa.String(length=50), nullable=True)
    )
    op.add_column(
        "payments", sa.Column("credit_card_last4", sa.String(length=4), nullable=True)
    )
    # Named on creation: an unnamed foreign key cannot be dropped on downgrade,
    # which is exactly how a `downgrade` ends up failing in production.
    op.create_foreign_key(
        "fk_payments_subscription",
        "payments",
        "subscriptions",
        ["subscription_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.alter_column(
        "payments",
        "amount",
        existing_type=sa.DOUBLE_PRECISION(),
        type_=sa.Numeric(precision=12, scale=2),
        existing_nullable=False,
        postgresql_using="amount::numeric",
    )

    op.execute(
        sa.text(
            """
            INSERT INTO plans (id, code, name, price, cycle, is_active)
            VALUES (gen_random_uuid(), :code, :name, :price, 'MONTHLY', true)
            ON CONFLICT (code) DO NOTHING
            """
        ).bindparams(
            code=SEEDED_PLAN_CODE,
            name=SEEDED_PLAN_NAME,
            price=SEEDED_PLAN_PRICE,
        )
    )


def downgrade() -> None:
    """Remove the subscription tables and the cycle columns from `payments`."""
    op.alter_column(
        "payments",
        "amount",
        existing_type=sa.Numeric(precision=12, scale=2),
        type_=sa.DOUBLE_PRECISION(),
        existing_nullable=False,
        postgresql_using="amount::double precision",
    )
    op.drop_constraint("fk_payments_subscription", "payments", type_="foreignkey")
    op.drop_column("payments", "credit_card_last4")
    op.drop_column("payments", "credit_card_brand")
    op.drop_column("payments", "invoice_url")
    op.drop_column("payments", "paid_at")
    op.drop_column("payments", "cycle_month")
    op.drop_column("payments", "subscription_id")

    op.drop_index("uq_subscriptions_open_per_user", table_name="subscriptions")
    op.drop_index("ix_subscriptions_user_status", table_name="subscriptions")
    op.drop_index("ix_subscriptions_asaas_id", table_name="subscriptions")
    op.drop_table("subscriptions")

    op.drop_index("uq_payment_methods_default_per_user", table_name="payment_methods")
    op.drop_index("ix_payment_methods_user", table_name="payment_methods")
    op.drop_table("payment_methods")

    op.drop_index("ix_beta_access_expires", table_name="beta_access")
    op.drop_table("beta_access")

    op.drop_index("ix_plans_active", table_name="plans")
    op.drop_table("plans")
