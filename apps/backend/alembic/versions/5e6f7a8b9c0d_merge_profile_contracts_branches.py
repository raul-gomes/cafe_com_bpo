"""merge profile-company and contracts branches

Revision ID: 5e6f7a8b9c0d
Revises: a1b2c3d4e5f6, b1c2d3e4f5a6
Create Date: 2026-09-24 12:30:00.000000

Ponto de merge que unifica os dois ramos de heads pré-existentes
(``a1b2c3d4e5f6`` — migration órfã tornada idempotente — e
``b1c2d3e4f5a6`` — number/fields/template_sections em contratos).
Não altera o schema: ambas as mudanças já estão representadas pelos
ancestrais, que passam a convergir num único head.

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "5e6f7a8b9c0d"
down_revision: str | Sequence[str] | None = ("a1b2c3d4e5f6", "b1c2d3e4f5a6")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
