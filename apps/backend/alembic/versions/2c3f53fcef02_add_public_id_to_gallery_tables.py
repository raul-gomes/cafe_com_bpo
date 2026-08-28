"""add public_id to gallery tables

Revision ID: 2c3f53fcef02
Revises: f7a8b9c0d1e2
Create Date: 2026-08-27 14:52:24.972083

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2c3f53fcef02'
down_revision: Union[str, Sequence[str], None] = 'f7a8b9c0d1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Adiciona public_id nas tabelas de galeria para guardar o ID do Cloudinary."""
    op.add_column('common_gallery_items', sa.Column('public_id', sa.String(length=500), nullable=True))
    op.add_column('gallery_items', sa.Column('public_id', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Remove a coluna public_id das tabelas de galeria."""
    op.drop_column('gallery_items', 'public_id')
    op.drop_column('common_gallery_items', 'public_id')
