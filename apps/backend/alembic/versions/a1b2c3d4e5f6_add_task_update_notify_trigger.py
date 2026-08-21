"""add task_update_notify_trigger for SSE real-time

Revision ID: a1b2c3d4e5f6
Revises: f1004e8202e1
Create Date: 2026-08-21 18:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f1004e8202e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TRIGGER_SQL = """
CREATE OR REPLACE FUNCTION notify_task_update() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'task_updates',
        json_build_object(
            'task_id', NEW.id,
            'phase_id', NEW.phase_id,
            'client_id', NEW.client_id,
            'template_id', NEW.template_id,
            'updated_at', NEW.updated_at
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_task_update
    AFTER UPDATE OF phase_id ON tasks
    FOR EACH ROW
    WHEN (OLD.phase_id IS DISTINCT FROM NEW.phase_id)
    EXECUTE FUNCTION notify_task_update();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS trg_notify_task_update ON tasks;
DROP FUNCTION IF EXISTS notify_task_update();
"""


def upgrade() -> None:
    op.execute(TRIGGER_SQL)


def downgrade() -> None:
    op.execute(DROP_SQL)
