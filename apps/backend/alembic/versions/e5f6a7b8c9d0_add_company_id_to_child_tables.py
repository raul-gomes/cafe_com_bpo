"""add company_id to child tables (R2 - migrate ownership to companies)

Release 2 do plano `docs/plano-unificado-companies-read-to-render.md`: as
tabelas filhas ganham `company_id`, e as que só aceitam cliente ganham também
`company_type` com FK composta — a garantia de "só cliente tem equipe, rotina,
SLA e tarefa" passa a ser do banco, não do código.

Ainda é aditiva: `client_id`/`prospect_id` continuam existindo e preenchidos, e
esta migration não muda nenhuma linha legada. O que ela faz é *marcar* o dono
de cada linha, para a leitura poder migrar na release seguinte com a
verificação de que nada mudou de dono (V5).

Revision ID: e5f6a7b8c9d0
Revises: c3d4e5f6a7b8
Create Date: 2026-09-29

"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.orm import Session

from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

log = logging.getLogger("alembic.runtime.migration")

# Tabela -> (aceita prospecto?, apaga junto com a empresa?)
CLIENT_ONLY_TABLES = ("tasks", "teams", "client_slas", "client_template_assignments")
ANY_TYPE_TABLES = ("pricing_scenarios", "contracts")

# Regra §16: nada de hard delete. Nenhuma FK para `companies` apaga a linha
# filha — o banco recusa o `DELETE` (NO ACTION) e a desativação é feita pela
# aplicação, em cascata de `is_active = false`, preservando o histórico.
# `ondelete` explícito (e não o default) para o autogenerate não propor
# `DROP CONSTRAINT` + recriação de uma constraint que já existe como está.
FK_ONDELETE = "NO ACTION"


def upgrade() -> None:
    for table in CLIENT_ONLY_TABLES:
        op.add_column(table, sa.Column("company_id", sa.UUID(), nullable=True))
        op.add_column(
            table,
            sa.Column(
                "company_type",
                sa.String(length=20),
                server_default="client",
                nullable=False,
            ),
        )
        op.create_check_constraint(
            f"ck_{table}_company_type", table, "company_type = 'client'"
        )
        op.create_foreign_key(
            f"fk_{table}_company",
            table,
            "companies",
            ["company_id", "company_type"],
            ["id", "type"],
            ondelete=FK_ONDELETE,
        )
        if table != "teams":
            op.create_index(f"ix_{table}_company_id", table, ["company_id"])

    # O time é 1:1 com o cliente, então a unicidade se repete aqui — dois times
    # para a mesma empresa continuariam sendo um erro do banco.
    op.create_index("ix_teams_company_id", "teams", ["company_id"], unique=True)

    for table in ANY_TYPE_TABLES:
        op.add_column(table, sa.Column("company_id", sa.UUID(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_company_id",
            table,
            "companies",
            ["company_id"],
            ["id"],
            ondelete=FK_ONDELETE,
        )
        op.create_index(f"ix_{table}_company_id", table, ["company_id"])

    from src.modules.companies.fk_backfill import backfill_company_fks

    session = Session(op.get_bind())
    report = backfill_company_fks(session)
    session.commit()
    log.info(f"[companies/fks] backfill: {report.as_dict()}")


def downgrade() -> None:
    for table in ANY_TYPE_TABLES:
        op.drop_index(f"ix_{table}_company_id", table_name=table)
        op.drop_constraint(f"fk_{table}_company_id", table, type_="foreignkey")
        op.drop_column(table, "company_id")

    # `ix_teams_company_id` é o índice ÚNICO do time (1:1 com a empresa), criado
    # fora do laço porque `teams` não recebe índice simples. Ele é derrubado aqui
    # e **não** dentro do laço abaixo: um segundo `drop_index` do mesmo nome
    # levanta `index ... does not exist` e aborta o downgrade no meio, deixando
    # `company_type`/`company_id` em `teams` e o banco num estado misto.
    op.drop_index("ix_teams_company_id", table_name="teams")
    for table in CLIENT_ONLY_TABLES:
        if table != "teams":
            op.drop_index(f"ix_{table}_company_id", table_name=table)
        op.drop_constraint(f"fk_{table}_company", table, type_="foreignkey")
        op.drop_check_constraint(f"ck_{table}_company_type", table)
        op.drop_column(table, "company_type")
        op.drop_column(table, "company_id")
