"""add subscriptions.asaas_checkout_id

Revision ID: a7c3e5b9d1f2
Revises: c4d5e6f7a8b
Create Date: 2026-10-06

Written by hand like `c4d5e6f7a8b`: `--autogenerate` is unavailable in this
environment (P-15) and the database carries known drift (P-7). The column
mirrors `Subscription.asaas_checkout_id` — the key the `CHECKOUT_*` webhook
matches a paid session against, because that payload carries only
`checkout.id` (P-16).

The unique constraint is left unnamed, exactly as the model declares it
(`unique=True`); PostgreSQL then names it `subscriptions_asaas_checkout_id_key`,
which is the name `downgrade` drops.

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7c3e5b9d1f2"
down_revision: str | Sequence[str] | None = "c4d5e6f7a8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Adds the checkout session id and its uniqueness.

    Returns:
        None.
    """
    op.add_column(
        "subscriptions",
        sa.Column("asaas_checkout_id", sa.String(length=100), nullable=True),
    )
    op.create_unique_constraint(None, "subscriptions", ["asaas_checkout_id"])


def downgrade() -> None:
    """Removes the checkout session id.

    Returns:
        None.
    """
    # The constraint was created unnamed, so the name is the one PostgreSQL
    # generates for it: `{table}_{column}_key`.
    op.drop_constraint(
        "subscriptions_asaas_checkout_id_key",
        "subscriptions",
        type_="unique",
    )
    op.drop_column("subscriptions", "asaas_checkout_id")
