"""global canonical phases (drop user_id from task_phases)

Revision ID: 7d7670c5f1cc
Revises: e4f1a2b3c4d5
Create Date: 2026-08-19 00:00:00.000000

As fases do Kanban passam a ser GLOBAIS e canônicas (3 fases compartilhadas
por todos os usuários). Remove o vínculo `task_phases.user_id`; as fases
existentes são consolidadas automaticamente no startup da aplicação
(``ensure_canonical_phases``), que cria as 3 canônicas e migra as tasks.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "7d7670c5f1cc"
down_revision: str | None = "e4f1a2b3c4d5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("task_phases_user_id_fkey", "task_phases", type_="foreignkey")
    op.drop_column("task_phases", "user_id")


def downgrade() -> None:
    op.add_column(
        "task_phases",
        sa.Column("user_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "task_phases_user_id_fkey",
        "task_phases",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
