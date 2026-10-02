"""add negotiated_at to companies (Governança: mês da prospecção)

Regra do dono (2026-10-01): na Governança o negócio aparece no mês em que
**começou a prospecção** e, se fechou, também no mês em que fechou. A Governança
passa a ler de `companies`, mas a linha que sobrevive a uma conversão é a do
cliente — criada no instante da conversão, ou seja, em outro mês. Sem guardar a
data original da prospecção, todo negócio prospectado antes da conversão
mudaria de mês na tela.

A coluna é aditiva e reversível: `downgrade` só remove a coluna, nenhum dado é
re-criado. O backfill é escrito para ser idempotente e para não depender de
`type`, porque uma empresa convertida é `type='client'` e mesmo assim tem data
de prospecção.

Revision ID: b1c2d3e4f5a6
Revises: f4a5b6c7d8e9
Create Date: 2026-10-01

"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | Sequence[str] | None = "f4a5b6c7d8e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

log = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    """Cria a coluna e preenche a data de prospecção de quem já existe."""
    op.add_column(
        "companies",
        sa.Column("negotiated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # 1) Prospecto em aberto: a prospecção começou quando a empresa nasceu.
    op.execute(
        sa.text(
            """
            UPDATE companies
               SET negotiated_at = created_at
             WHERE negotiated_at IS NULL
               AND type = 'prospect'
            """
        )
    )

    # 2) Empresa que veio de um prospecto convertido: a data é a do prospecto
    #    que originou o cliente. `prospects.converted_client_id` é o vínculo,
    #    e ela sobrevive à conversão justamente porque a Governança ainda lê a
    #    linha do prospecto. Sem este passo, todo negócio já capturado ficaria
    #    sem mês de prospecção.
    op.execute(
        sa.text(
            """
            UPDATE companies
               SET negotiated_at = (
                   SELECT p.created_at
                     FROM prospects p
                    WHERE p.converted_client_id = companies.id
               )
             WHERE negotiated_at IS NULL
               AND type = 'client'
               AND EXISTS (
                   SELECT 1
                     FROM prospects p
                    WHERE p.converted_client_id = companies.id
               )
            """
        )
    )

    # 3) Cliente criado direto (nunca foi prospecto) não tem mês de prospecção:
    #    a Governança não o lista, então `NULL` é a resposta certa e não um buraco.
    total = (
        op.get_bind()
        .execute(
            sa.text("SELECT count(*) FROM companies WHERE negotiated_at IS NOT NULL")
        )
        .scalar_one()
    )
    log.info("companies.negotiated_at preenchida em %s linha(s)", total)


def downgrade() -> None:
    """Remove a coluna. O dado da data original da prospecção se perde — a data
    ainda pode ser recuperada de `prospects.created_at` enquanto essa tabela
    existir, por isso o downgrade é aceitável até o R4."""
    op.drop_column("companies", "negotiated_at")
