import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  MessageSquare,
  Bell,
  Calendar as CalendarIcon,
  ArrowRight,
  AlertCircle,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { useDashboard } from '../../api/hooks/useDashboard';
import { useTasks } from '../../api/hooks/useTasks';
import { useNotifications } from '../../api/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskModal } from '../../components/tasks/TaskModal';
import { SLAAlerts } from '../../components/dashboard/SLAAlerts';
import { TaskResponse } from '../../schemas/tasks';
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
  const { useUpdateTaskStatus } = useTasks();
  const { useMarkAsRead } = useNotifications();
  const { data: summary, isLoading } = useDashboardSummary();
  const updateTaskStatus = useUpdateTaskStatus();
  const markAsRead = useMarkAsRead();
  const navigate = useNavigate();

  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'A Fazer';
      case 'doing': return 'Em Andamento';
      case 'done': return 'Concluído';
      default: return status;
    }
  };

  const handleUpdateStatus = (id: string, status: string) => {
    updateTaskStatus.mutate({ id, status });
    setShowStatusMenu(null);
  };

  const handleViewTask = (task: DashboardTask) => {
    setSelectedTask(task);
    setModalOpen(true);
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
      <div className="mb-12 flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/80">
          Bem-vindo de volta
        </p>
        <h1 className="text-[32px] font-light tracking-tight text-foreground">
          Olá, {summary?.user_name || 'Usuário'}
        </h1>
      </div>

      {/* Urgent Tasks Section */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
            <AlertCircle size={16} className="text-primary" /> Atenção Imediata
          </h2>
          <Link
            to="/painel/tarefas"
            className="flex items-center gap-1 text-[12px] text-primary no-underline"
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
                  <div className="mb-2 flex items-start justify-between">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">
                      {task.client_name || 'Cliente'}
                    </span>
                    <button
                      onClick={() => handleViewTask(task as any)}
                      className="cursor-pointer border-none bg-transparent text-muted-foreground"
                      title="Ver Detalhes"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                  <div className="mb-4 text-[15px] font-bold leading-tight text-foreground">
                    {task.title}
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between">
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

                  {/* Status dropdown */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 bg-white/[0.03] px-2.5 py-1 text-[11px]"
                      onClick={() => setShowStatusMenu(showStatusMenu === task.id ? null : task.id)}
                    >
                      {getStatusLabel(task.status)} <ChevronDown size={12} />
                    </Button>

                    {showStatusMenu === task.id && (
                      <div className="absolute bottom-full right-0 z-10 mb-2 w-[140px] rounded-md border border-white/10 bg-card p-1 shadow-xl">
                        {['todo', 'doing', 'done'].map((s) => (
                          <button
                            key={s}
                            onClick={() => handleUpdateStatus(task.id, s)}
                            className={cn(
                              'w-full rounded-sm px-3 py-2 text-left text-[12px] transition-colors hover:bg-primary/10 hover:text-primary',
                              task.status === s
                                ? 'font-bold text-primary'
                                : 'font-normal text-foreground'
                            )}
                          >
                            {getStatusLabel(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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

      {/* SLA Alerts Section */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
          <AlertCircle size={16} /> Alertas de SLA
        </h2>
        <SLAAlerts />
      </section>

      {/* Activity Feed and Stats */}
      <div className="grid grid-cols-[1fr_300px] gap-8">
        {/* Activity Feed */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-[14px] font-bold uppercase tracking-wide text-muted-foreground">
            <MessageSquare size={16} /> Atividade Recente
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
                      {activity.type === 'comment' ? (
                        <MessageSquare
                          size={20}
                          className={activity.is_read ? 'text-muted-foreground' : 'text-primary'}
                        />
                      ) : (
                        <Bell size={20} className="text-primary" />
                      )}
                    </div>

                    <div className="flex-1">
                      <div
                        className={cn(
                          'text-[14px] leading-relaxed',
                          activity.is_read ? 'font-normal text-foreground' : 'font-semibold text-foreground'
                        )}
                      >
                        {activity.type === 'comment' ? (
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

        {/* Sidebar — Quick Summary */}
        <aside>
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
              <span className="text-[15px] font-bold text-primary">
                {summary?.stats?.unread_notifications_count || 0} não lidas
              </span>
            </div>
            <div className="px-5 py-4">
              <Button variant="default" className="w-full" onClick={() => navigate('/painel/orcamentos')}>
                Novo Orçamento
              </Button>
            </div>
          </Card>

          <Card className="mt-6">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-[13px] font-semibold text-foreground">Calendário</span>
              <CalendarIcon size={14} className="text-muted-foreground" />
            </div>
            <div className="px-5 pb-5 pt-2 text-center text-[11px] text-muted-foreground">
              Integração com calendário em breve.
            </div>
          </Card>
        </aside>
      </div>

      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        task={selectedTask as any}
      />
    </div>
  );
};
