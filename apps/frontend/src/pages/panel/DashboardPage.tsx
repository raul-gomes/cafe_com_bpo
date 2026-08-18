import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  MessageSquare,
  Bell,
  ArrowRight,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboard } from '../../api/hooks/useDashboard';
import { useTasks } from '../../api/hooks/useTasks';
import { useAppNotifications } from '../../api/hooks/useAppNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PendingInvitationCard } from '../../components/dashboard/PendingInvitationCard';
import { TaskCalendar } from '../../components/tasks/TaskCalendar';
import { TaskResponse } from '../../schemas/tasks';
import { apiClient } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { cn } from '../../lib/utils';

/* ── Dashboard-specific task fields (from summary endpoint) ── */
interface DashboardTask extends TaskResponse {
  client_name?: string;
  is_overdue?: boolean;
  days_remaining?: number | null;
}

export const DashboardPage: React.FC = () => {
  const { useDashboardSummary } = useDashboard();
  const { useUpdateTaskStatus, useTasksList } = useTasks();
  const { useMarkAsRead } = useAppNotifications();
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: tasks } = useTasksList();
  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients/');
      return data as any[];
    },
  });
  const updateTaskStatus = useUpdateTaskStatus();
  const markAsRead = useMarkAsRead();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /* ── Loading state ── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-[300px]" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  /* ── Helpers ── */

  const handleComplete = (task: DashboardTask) => {
    updateTaskStatus.mutate(
      { id: task.id, status: 'done' },
      {
        onSuccess: () => {
          // Remove the task from the dashboard immediately
          queryClient.setQueryData(['dashboard', 'summary'], (old: any) => {
            if (!old) return old;
            return {
              ...old,
              urgent_tasks: (old.urgent_tasks ?? []).filter((t: any) => t.id !== task.id),
              stats: {
                ...old.stats,
                pending_tasks_count: Math.max(0, (old.stats?.pending_tasks_count ?? 0) - 1),
              },
            };
          });
          queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
        },
      }
    );
  };

  const handleActivityClick = (activity: any) => {
    markAsRead.mutate(activity.id);
    if (activity.post_id) {
      navigate(`/painel/forum/${activity.post_id}`);
    }
  };

  /* ── Deadline helpers ── */
  const deadlineText = (task: DashboardTask) => {
    if (task.is_overdue) return `Atrasado ${Math.abs(task.days_remaining || 1)}d`;
    if (task.days_remaining !== undefined && task.days_remaining !== null) {
      if (task.days_remaining === 0) return 'Vence hoje';
      if (task.days_remaining === 1) return 'Vence amanhã';
      return `Vence em ${task.days_remaining}d`;
    }
    if (task.deadline) return formatDistanceToNow(new Date(task.deadline), { addSuffix: true, locale: ptBR });
    return 'Sem prazo';
  };

  const deadlineColor = (task: DashboardTask) => {
    if (task.is_overdue) return 'text-destructive';
    if (task.days_remaining !== undefined && task.days_remaining !== null && task.days_remaining <= 1) return 'text-warning';
    return 'text-muted-foreground';
  };

  /* ── Render ── */

  return (
    <div className="animate-[panelFadeIn_0.4s_ease-out]">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-strong/80">
          Bem-vindo de volta
        </p>
        <h1 className="text-[32px] font-light tracking-tight text-foreground">
          Olá, {summary?.user_name || 'Usuário'}
        </h1>
      </div>

      {/* Pending Team Invitations */}
      {summary?.pending_invitations && summary.pending_invitations.length > 0 && (
        <section className="mb-8">
          {summary.pending_invitations.map((invitation) => (
            <PendingInvitationCard key={invitation.invitation_id} invitation={invitation} />
          ))}
        </section>
      )}

      <div className="grid grid-cols-[1fr_300px] gap-8">
        {/* Main column */}
        <div className="min-w-0">
          {/* Urgent Tasks Section */}
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
                <AlertCircle size={16} className="text-primary-strong" /> Atenção Imediata
              </h2>
              <Link
                to="/painel/tarefas"
                className="flex items-center gap-1 text-[12px] text-primary-strong no-underline"
              >
                Ver todas <ArrowRight size={14} />
              </Link>
            </div>

            <div
              className="flex gap-4 overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: 'none' }}
            >
              {summary?.urgent_tasks && summary.urgent_tasks.length > 0 ? (
                summary.urgent_tasks.map((task) => (
                  <Card
                    key={task.id}
                    className="flex min-w-[320px] flex-col justify-between border-l-4 border-l-primary p-5"
                  >
                    <div>
                      <div className="mb-2 text-[10px] font-bold uppercase text-muted-foreground">
                        {task.client_name || 'Cliente'}
                      </div>
                      <div className="mb-4 text-[15px] font-bold leading-tight text-foreground">
                        {task.title}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <div
                        className={cn(
                          'flex items-center gap-1 text-[11px]',
                          deadlineColor(task),
                          task.is_overdue ? 'font-bold' : 'font-semibold'
                        )}
                      >
                        <Clock size={12} />
                        {deadlineText(task)}
                      </div>

                      <Button
                        variant="default"
                        size="sm"
                        className="gap-1.5 text-[11px]"
                        onClick={() => handleComplete(task)}
                      >
                        <Check size={14} /> Concluir
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="py-5 text-[14px] italic text-muted-foreground">
                  Nenhuma tarefa urgente no momento. Bom trabalho!
                </div>
              )}
            </div>
          </section>

          {/* Activity Feed */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
              <MessageSquare size={16} /> Atualizações do Fórum
            </h2>

            <div className="flex flex-col gap-3">
              {summary?.activities && summary.activities.length > 0 ? (
                summary.activities.map((activity) => (
                  <Card
                    key={activity.id}
                    className="cursor-pointer p-0"
                    onClick={() => handleActivityClick(activity)}
                  >
                    <div className="flex gap-4 p-4">
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center rounded-xl',
                          activity.is_read ? 'bg-white/5' : 'bg-primary/10'
                        )}
                      >
                        {activity.type === 'post_commented' ? (
                          <MessageSquare
                            size={20}
                            className={activity.is_read ? 'text-muted-foreground' : 'text-primary-strong'}
                          />
                        ) : (
                          <Bell size={20} className="text-primary-strong" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div
                          className={cn(
                            'text-[14px] leading-relaxed',
                            activity.is_read ? 'font-normal text-foreground' : 'font-semibold text-foreground'
                          )}
                        >
                          {activity.type === 'post_commented' ? (
                            <><strong>{activity.triggered_by_name}</strong> respondeu ao seu tópico no fórum</>
                          ) : (
                            <>Notificação do sistema</>
                          )}
                        </div>

                        {activity.message_snippet && (
                          <div className="mt-2 rounded-md border-l-[3px] border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] italic text-muted-foreground">
                            &ldquo;{activity.message_snippet}&hellip;&rdquo;
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Clock size={12} /> {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed bg-white/[0.02] p-12 text-center">
                  <div className="mb-4 opacity-50">
                    <Bell size={40} className="mx-auto" />
                  </div>
                  <div className="mb-2 text-[16px] font-semibold text-foreground">
                    Tudo em ordem por aqui!
                  </div>
                  <div className="text-[13px] text-muted-foreground">
                    Você não tem novas notificações no momento. <br />
                    Aproveite para focar nas suas tarefas ou dar uma olhada no fórum.
                  </div>
                </Card>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar — Quick Summary */}
        <aside className="sticky top-5 h-fit space-y-6">
          <div>
            <h2 className="mb-4 text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
              Resumo Rápido
            </h2>

            <Card className="divide-y divide-border">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[13px] text-muted-foreground">Tarefas Pendentes</span>
                <span className="text-[15px] font-bold text-foreground">
                  {summary?.stats?.pending_tasks_count || 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-[13px] text-muted-foreground">Notificações</span>
                <span className="text-[15px] font-bold text-primary-strong">
                  {summary?.stats?.unread_notifications_count || 0} não lidas
                </span>
              </div>
              <div className="px-5 py-4">
                <Button variant="default" className="w-full" onClick={() => navigate('/painel/orcamentos')}>
                  Novo Orçamento
                </Button>
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <TaskCalendar tasks={tasks || []} clients={clients || []} onEdit={() => {}} isMacro={true} />
          </Card>
        </aside>
      </div>
    </div>
  );
};