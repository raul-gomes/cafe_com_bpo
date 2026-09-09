import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Lock, Unlock, X, XCircle } from 'lucide-react';
import {
  getProjectApplications,
  acceptApplication,
  declineApplication,
  toggleProjectStatus,
  ProjectApplication,
  ProjectResponse,
} from '../../api/network';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  declined: 'Recusada',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-700',
  accepted: 'bg-emerald-500/15 text-emerald-700',
  declined: 'bg-muted text-muted-foreground',
};

interface ProjectApplicationsPanelProps {
  project: ProjectResponse;
  onUpdated: (project: ProjectResponse) => void;
}

export function ProjectApplicationsPanel({
  project,
  onUpdated,
}: ProjectApplicationsPanelProps) {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setApplications(await getProjectApplications(project.id));
    } catch {
      setError('Erro ao carregar as propostas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async (application: ProjectApplication) => {
    setActingId(application.id);
    setError('');
    try {
      const updated = await acceptApplication(application.id);
      setApplications((prev) =>
        prev.map((a) => (a.id === application.id ? updated : a))
      );
      toast.success(
        `Proposta de ${application.applicant.name || application.applicant.email} aceita`
      );
      if (updated.conversation_id) {
        navigate(`/painel/conversas/${updated.conversation_id}`);
      }
    } catch {
      setError('Erro ao aceitar a proposta. Tente novamente.');
    } finally {
      setActingId(null);
    }
  };

  const handleDecline = async (application: ProjectApplication) => {
    setActingId(application.id);
    setError('');
    try {
      const updated = await declineApplication(application.id);
      setApplications((prev) =>
        prev.map((a) => (a.id === application.id ? updated : a))
      );
      toast.success(
        `Proposta de ${application.applicant.name || application.applicant.email} recusada`
      );
    } catch {
      setError('Erro ao recusar a proposta. Tente novamente.');
    } finally {
      setActingId(null);
    }
  };

  const handleToggleStatus = async () => {
    setToggling(true);
    setError('');
    try {
      const updated = await toggleProjectStatus(project.id);
      toast.success(
        updated.applications_closed
          ? 'Projeto fechado para novas propostas'
          : 'Projeto aberto para novas propostas'
      );
      onUpdated(updated);
    } catch {
      setError('Erro ao alterar o status do projeto. Tente novamente.');
    } finally {
      setToggling(false);
    }
  };

  const pendingCount = applications.filter(
    (a) => a.status === 'pending'
  ).length;

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-foreground">
          Propostas de candidatos
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingCount} pendente{pendingCount > 1 ? 's' : ''}
            </Badge>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0',
              project.applications_closed && 'bg-amber-500/15 text-amber-700'
            )}
          >
            {project.applications_closed ? (
              <Lock size={11} className="mr-1" />
            ) : (
              <Unlock size={11} className="mr-1" />
            )}
            {project.applications_closed ? 'Fechado' : 'Aberto'}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={toggling}
          >
            {toggling ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : null}
            {project.applications_closed
              ? 'Reabrir para propostas'
              : 'Fechar para propostas'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-[13px] text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          Carregando propostas...
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-5 text-center text-[13px] text-muted-foreground">
          Nenhuma proposta recebida ainda.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {applications.map((application) => (
            <div
              key={application.id}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-foreground">
                    {application.applicant.name || application.applicant.email}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Enviada em{' '}
                    {new Date(application.created_at).toLocaleDateString('pt-BR')}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                    {application.message}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge
                    variant="secondary"
                    className={STATUS_STYLE[application.status]}
                  >
                    {STATUS_LABEL[application.status]}
                  </Badge>
                  {application.status === 'pending' && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAccept(application)}
                        disabled={actingId === application.id}
                        aria-label={`Aceitar proposta de ${application.applicant.name || application.applicant.email}`}
                      >
                        {actingId === application.id ? (
                          <Loader2 size={13} className="mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} className="mr-1" />
                        )}
                        Aceitar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDecline(application)}
                        disabled={actingId === application.id}
                        aria-label={`Recusar proposta de ${application.applicant.name || application.applicant.email}`}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        {actingId === application.id ? (
                          <XCircle size={13} className="mr-1" />
                        ) : (
                          <X size={13} className="mr-1" />
                        )}
                        Recusar
                      </Button>
                    </div>
                  )}
                  {application.status === 'accepted' &&
                    application.conversation_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          navigate(
                            `/painel/conversas/${application.conversation_id}`
                          )
                        }
                      >
                        Abrir conversa
                      </Button>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}