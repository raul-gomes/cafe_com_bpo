"""Índice (user_id, is_read) de app_notifications.

Toda a sinalização de "há coisa nova" conta não lidas: o badge do sino (poll de
30s), o indicador por categoria e o agrupamento por entidade. Sem índice, cada
dessas consultas é um seq scan da tabela inteira do usuário.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "d8e9f0a1b2c3"
down_revision: str | Sequence[str] | None = "c7d8e9f0a1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_app_notifications_user_read",
        "app_notifications",
        ["user_id", "is_read"],
    )


def downgrade() -> None:
    op.drop_index("ix_app_notifications_user_read", table_name="app_notifications")
