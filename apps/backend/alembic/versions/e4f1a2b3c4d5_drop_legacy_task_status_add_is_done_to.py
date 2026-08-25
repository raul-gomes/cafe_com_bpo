"""drop legacy task status, add is_done to phases

Revision ID: e4f1a2b3c4d5
Revises: 276b8d51e2d9
Create Date: 2026-08-18 00:00:00.000000

Remove o campo legado `tasks.status` (todo/doing/done) e adiciona o flag
`is_done` em `task_phases` para marcar explicitamente a fase de conclusão.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e4f1a2b3c4d5"
down_revision: str | None = "276b8d51e2d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "task_phases",
        sa.Column(
            "is_done",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.drop_column("tasks", "status")


def downgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column(
            "status", sa.String(length=50), server_default="todo", nullable=False
        ),
    )
    op.drop_column("task_phases", "is_done")
