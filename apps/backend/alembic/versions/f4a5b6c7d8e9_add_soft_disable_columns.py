"""add soft-disable columns to the tables that lack them (R3)

Regra §16 (dono do produto, 2026-09-30): **não existe hard delete**. Desativar
uma empresa marca `is_active = false` nela e em toda linha ligada por
`company_id`, preservando o histórico — quando a empresa esteve ativa e o que
existia vinculado a ela.

A cascata da R2 cobriu só `tasks` e `pricing_scenarios` (e por `client_id`).
Para cobrir as demais, três tabelas precisavam da mesma par:

- `client_slas` e `teams` não tinham `is_active` nem `deleted_at` — sem
  `is_active` não há como "desativar" um SLA ou um time;
- `client_template_assignments` tinha `is_active` mas não `deleted_at` — sem a
  data, a auditoria perde *quando* a linha saiu de vista.

`server_default` mantém a migration aditiva e reversível: linhas existentes
nasce/continua ativas, e o `downgrade` só remove as colunas novas (nenhum dado é
re-criado).

Revision ID: f4a5b6c7d8e9
Revises: e5f6a7b8c9d0
Create Date: 2026-09-30

"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f4a5b6c7d8e9"
down_revision: str | Sequence[str] | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

log = logging.getLogger("alembic.runtime.migration")

# Tabela -> (precisa de is_active?, precisa de deleted_at?)
SOFT_DISABLE_COLUMNS = {
    "client_slas": (True, True),
    "teams": (True, True),
    "client_template_assignments": (False, True),
}


def upgrade() -> None:
    for table, (needs_is_active, needs_deleted_at) in SOFT_DISABLE_COLUMNS.items():
        if needs_is_active:
            op.add_column(
                table,
                sa.Column(
                    "is_active",
                    sa.Boolean(),
                    server_default="true",
                    nullable=False,
                ),
            )
        if needs_deleted_at:
            op.add_column(
                table,
                sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            )
        log.info(f"[companies/soft-disable] {table}: is_active/deleted_at pronto")


def downgrade() -> None:
    for table, (needs_is_active, needs_deleted_at) in SOFT_DISABLE_COLUMNS.items():
        if needs_deleted_at:
            op.drop_column(table, "deleted_at")
        if needs_is_active:
            op.drop_column(table, "is_active")
