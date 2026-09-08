import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Check, X, Loader2 } from 'lucide-react';
import {
  getMyInvitations,
  acceptInvitation,
  declineInvitation,
  ProjectInvitation,
} from '../../api/network';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export function NetworkInvitationsPanel() {
  const navigate = useNavigate();
  const [invites, setInvites] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const pending = invites.filter((invite) => invite.status === 'pending');

  const load = async () => {
    try {
      setInvites(await getMyInvitations());
      setError('');
    } catch {
      setError('Erro ao carregar os convites recebidos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAccept = async (invite: ProjectInvitation) => {
    setBusyId(invite.id);
    setError('');
    try {
      const updated = await acceptInvitation(invite.id);
      if (updated.conversation_id) {
        navigate(`/painel/conversas/${updated.conversation_id}`);
        return;
      }
    } catch {
      setError('Erro ao aceitar o convite. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (invite: ProjectInvitation) => {
    setBusyId(invite.id);
    setError('');
    try {
      await declineInvitation(invite.id);
      await load();
    } catch {
      setError('Erro ao recusar o convite. Tente novamente.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;
  if (pending.length === 0) return null;

  return (
    <Card className="mb-8 border-primary/20 bg-primary/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Mail size={18} className="text-primary" />
        <h3 className="m-0 text-[16px] font-bold text-foreground">
          Convites recebidos
        </h3>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary-strong">
          {pending.length}
        </span>
      </div>

      {error && (
        <p className="mb-3 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {pending.map((invite) => (
          <div
            key={invite.id}
            className="rounded-lg border border-border bg-background p-4"
          >
            <div className="text-[14px] font-semibold text-foreground">
              {invite.invited_user.name || invite.invited_user.email}
              <span className="font-normal text-muted-foreground"> · {invite.project_title}</span>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {invite.message}
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busyId === invite.id}
                onClick={() => handleDecline(invite)}
              >
                <X size={14} className="mr-1.5" />
                Recusar
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={busyId === invite.id}
                onClick={() => handleAccept(invite)}
              >
                {busyId === invite.id ? (
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                ) : (
                  <Check size={14} className="mr-1.5" />
                )}
                Aceitar e conversar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}