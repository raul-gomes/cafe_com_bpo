"""add team_update_notify_trigger for SSE real-time team changes

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-08-21 19:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TRIGGER_SQL = """
-- Função: notifica mudanças em equipe (rotinas, membros, convites)
CREATE OR REPLACE FUNCTION notify_team_update() RETURNS trigger AS $$
DECLARE
    payload json;
BEGIN
    IF TG_TABLE_NAME = 'invitation_routines' THEN
        IF TG_OP = 'DELETE' THEN
            payload := json_build_object(
                'type', 'routine_changed',
                'invitation_id', OLD.invitation_id,
                'template_id', OLD.template_id,
                'action', TG_OP
            );
        ELSE
            payload := json_build_object(
                'type', 'routine_changed',
                'invitation_id', NEW.invitation_id,
                'template_id', NEW.template_id,
                'action', TG_OP
            );
        END IF;

    ELSIF TG_TABLE_NAME = 'team_members' THEN
        payload := json_build_object(
            'type', 'member_changed',
            'team_id', NEW.team_id,
            'user_id', NEW.user_id,
            'is_active', NEW.is_active,
            'action', TG_OP
        );

    ELSIF TG_TABLE_NAME = 'team_invitations' THEN
        payload := json_build_object(
            'type', 'invitation_changed',
            'team_id', NEW.team_id,
            'invited_email', NEW.invited_email,
            'status', NEW.status,
            'action', TG_OP
        );
    END IF;

    PERFORM pg_notify('team_updates', payload::text);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger em invitation_routines (INSERT/DELETE = rotina adicionada/removida)
CREATE TRIGGER trg_notify_invitation_routines
    AFTER INSERT OR DELETE ON invitation_routines
    FOR EACH ROW
    EXECUTE FUNCTION notify_team_update();

-- Trigger em team_members (UPDATE is_active = membro adicionado/removido)
CREATE TRIGGER trg_notify_team_members
    AFTER UPDATE OF is_active ON team_members
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION notify_team_update();

-- Trigger em team_invitations (UPDATE status = convite aceito/declinado)
CREATE TRIGGER trg_notify_team_invitations
    AFTER UPDATE OF status ON team_invitations
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION notify_team_update();
"""

DROP_SQL = """
DROP TRIGGER IF EXISTS trg_notify_invitation_routines ON invitation_routines;
DROP TRIGGER IF EXISTS trg_notify_team_members ON team_members;
DROP TRIGGER IF EXISTS trg_notify_team_invitations ON team_invitations;
DROP FUNCTION IF EXISTS notify_team_update();
"""


def upgrade() -> None:
    op.execute(TRIGGER_SQL)


def downgrade() -> None:
    op.execute(DROP_SQL)
