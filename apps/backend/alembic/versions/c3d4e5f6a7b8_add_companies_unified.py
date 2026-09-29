"""add companies (unified client/prospect) and backfill from legacy tables

Fase 2 (expand) do plano `docs/plano-unificacao-clientes-prospectos.md`.

Esta migration é **aditiva**: cria `companies`, estende `contacts` e popula
tudo. Não renomeia, não apaga e não troca FK — `clients` e `prospects`
continuam intactas e nothing lê `companies` ainda, então a aplicação segue
igual antes e depois. A troca das FKs é a release seguinte (R2).

Revision ID: c3d4e5f6a7b8
Revises: 09d0d0d7300b
Create Date: 2026-09-29

"""

import logging
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.orm import Session

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "09d0d0d7300b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("cnpj", sa.String(length=50), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("color", sa.String(length=10), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("segment", sa.String(length=100), nullable=True),
        sa.Column("street", sa.String(length=255), nullable=True),
        sa.Column("number", sa.String(length=20), nullable=True),
        sa.Column("complement", sa.String(length=255), nullable=True),
        sa.Column("neighborhood", sa.String(length=100), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("state", sa.String(length=50), nullable=True),
        sa.Column("cep", sa.String(length=20), nullable=True),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reproved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("primary_contact_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.CheckConstraint("type IN ('prospect', 'client')", name="ck_companies_type"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        # Habilita a FK composta que garante "só cliente tem equipe/rotina".
        sa.UniqueConstraint("id", "type", name="uq_companies_id_type"),
    )
    op.create_index(
        "ix_companies_user_type", "companies", ["user_id", "type", "is_active"]
    )

    with op.batch_alter_table("contacts") as batch:
        batch.add_column(sa.Column("company_id", sa.UUID(), nullable=True))
        batch.add_column(sa.Column("cpf", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("cargo", sa.String(length=100), nullable=True))
        batch.create_foreign_key(
            "fk_contacts_company_id", "companies", ["company_id"], ["id"]
        )

    # `companies` -> `contacts` fica por último: as duas se referenciam e o
    # Postgres exige a constraint depois que ambas existem. `op.create_foreign_key`
    # é usado em vez de declarar na `create_table` porque, no momento em que a
    # tabela é criada, `contacts` ainda não tem a coluna nova.
    op.create_foreign_key(
        "fk_companies_primary_contact_id",
        "companies",
        "contacts",
        ["primary_contact_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # O preenchimento é a mesma função testada na suíte (testes/
    # test_companies_backfill.py), não uma cópia: o que roda aqui é o que foi
    # testado. Ela roda na conexão da migration, sem abrir sessão própria.
    from src.modules.companies.backfill import backfill_companies

    session = Session(op.get_bind())
    report = backfill_companies(session)
    session.commit()
    logging.getLogger("alembic.runtime.migration").info(
        f"[companies] backfill: {report.as_dict()}"
    )


def downgrade() -> None:
    with op.batch_alter_table("contacts") as batch:
        batch.drop_constraint("fk_contacts_company_id", type_="foreignkey")
        batch.drop_column("cargo")
        batch.drop_column("cpf")
        batch.drop_column("company_id")

    op.drop_constraint(
        "fk_companies_primary_contact_id", "companies", type_="foreignkey"
    )
    op.drop_index("ix_companies_user_type", table_name="companies")
    op.drop_table("companies")
