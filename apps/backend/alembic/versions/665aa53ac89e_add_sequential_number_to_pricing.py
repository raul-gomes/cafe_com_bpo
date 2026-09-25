"""add sequential number to pricing_scenarios

Revision ID: 665aa53ac89e
Revises: d4e5f6a7b8c9
Create Date: 2026-09-25

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "665aa53ac89e"
down_revision: str | Sequence[str] | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("pricing_scenarios", sa.Column("number", sa.Integer(), nullable=True))

    # Backfill: numerar os orçamentos existentes por usuário (por data de criação),
    # incluindo os soft-deleted para não colidir com a próxima sequência.
    op.execute(
        """
        UPDATE pricing_scenarios
        SET number = seq.rn
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id
                       ORDER BY created_at, id
                   ) AS rn
            FROM pricing_scenarios
        ) AS seq
        WHERE pricing_scenarios.id = seq.id
          AND pricing_scenarios.number IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("pricing_scenarios", "number")
