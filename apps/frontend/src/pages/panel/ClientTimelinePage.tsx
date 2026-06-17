import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Mail, Paperclip, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ClientTimelineTask } from '../../schemas/tasks';
import { EmailComposeModal } from '../../components/tasks/EmailComposeModal';
import { cn } from '../../lib/utils';

const SLA_COLORS: Record<string, { bg: string; text: string; icon: any }> = {
  on_time: { bg: 'rgba(34,197,94,0.1)', text: '#22c55e', icon: CheckCircle },
  warning: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', icon: Clock },
  overdue: { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', icon: XCircle },
};

const SLA_LABELS: Record<string, string> = {
  on_time: 'No prazo',
  warning: 'Próximo do vencimento',
  overdue: 'Atrasada',
};

export const ClientTimelinePage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const { useClientTimeline } = useTasks();
  const { data: timeline } = useClientTimeline(clientId!, currentMonth);

  const [emailTask, setEmailTask] = useState<ClientTimelineTask | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data } = await apiClient.get('/clients/');
      return data;
    }
  });

  const client = clients?.find((c: any) => c.id === clientId);

  const goPrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const goNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const formatMonth = (m: string) => {
    const [y, mon] = m.split('-').map(Number);
    return new Date(y, mon - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleEmailTask = (task: ClientTimelineTask) => {
    setEmailTask(task);
    setShowEmailModal(true);
  };

  return (
    <div className="tasks-page animate-[panelFadeIn_0.4s_ease-out]">
      <Breadcrumb items={[
        { label: 'Painel', to: '/painel' },
        { label: 'Empresas', to: '/painel/empresas' },
        { label: client?.name || 'Timeline' },
      ]} />

      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/painel/empresas')} className="gap-2 text-[13px]">
          <ArrowLeft size={16} /> Voltar
        </Button>
      </div>

      {/* Client header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1>{client?.name || 'Carregando...'}</h1>
          <p className="flex gap-2 items-center">
            <Calendar size={14} /> Timeline de Entregas
            {client?.email && <span className="text-muted-foreground">• {client.email}</span>}
          </p>
        </div>
      </div>

      {timeline && (
        <>
          {/* Stats */}
          <div className="flex gap-3 mb-6">
            <div className="flex-1 p-3.5 bg-card rounded-lg text-center">
              <div className="text-2xl font-extrabold text-green-500">{timeline.stats.on_time}</div>
              <div className="text-[11px] text-muted-foreground">No prazo</div>
            </div>
            <div className="flex-1 p-3.5 bg-card rounded-lg text-center">
              <div className="text-2xl font-extrabold text-amber-500">{timeline.stats.warning}</div>
              <div className="text-[11px] text-muted-foreground">⚠️ Próximas</div>
            </div>
            <div className="flex-1 p-3.5 bg-card rounded-lg text-center">
              <div className="text-2xl font-extrabold text-red-500">{timeline.stats.overdue}</div>
              <div className="text-[11px] text-muted-foreground">🔴 Atrasadas</div>
            </div>
            <div className="flex-1 p-3.5 bg-card rounded-lg text-center">
              <div className="text-2xl font-extrabold text-primary">{timeline.stats.in_progress}</div>
              <div className="text-[11px] text-muted-foreground">Em andamento</div>
            </div>
          </div>

          {/* SLA configs */}
          {timeline.slas.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {timeline.slas.map((sla: { process_type: string; sla_days: number }, idx: number) => (
                <span key={idx} className="px-3 py-1 rounded-[6px] bg-primary/10 text-primary text-xs font-bold">
                  SLA: {sla.process_type} — {sla.sla_days}d
                </span>
              ))}
            </div>
          )}

          {/* Month navigation */}
          <div className="flex items-center justify-center gap-4 mb-5">
            <button onClick={goPrevMonth} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
              <ChevronLeft size={20} />
            </button>
            <span className="text-base font-bold capitalize text-foreground">
              {formatMonth(currentMonth)}
            </span>
            <button onClick={goNextMonth} className="bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Tasks */}
          {timeline.tasks.length === 0 ? (
            <Card className="p-0">
              <CardContent className="flex flex-col items-center py-10">
                <Calendar size={40} className="text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhuma tarefa para este mês.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {timeline.tasks.map((task: ClientTimelineTask) => {
                const slaColor = SLA_COLORS[task.sla_status] || SLA_COLORS.on_time;
                const SLAIcon = slaColor.icon;
                return (
                  <Card
                    key={task.id}
                    className={cn(
                      "p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-muted/50",
                      task.sla_status === 'overdue' && "bg-red-500/[0.03]"
                    )}
                    style={{ borderLeft: `4px solid ${slaColor.text}` }}
                    onClick={() => navigate(`/painel/tarefas`, { state: { taskId: task.id } })}
                  >
                    <SLAIcon size={18} className="shrink-0" style={{ color: slaColor.text }} />
                    
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-0.5">{task.title}</div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {task.deadline && (
                          <span>📅 {new Date(task.deadline).toLocaleDateString('pt-BR')}</span>
                        )}
                        {task.process_type && (
                          <span className="px-1.5 py-0.5 rounded-[4px] bg-primary/10 text-primary font-semibold">{task.process_type}</span>
                        )}
                        {task.time_estimate_minutes && <span>⏱ {task.time_estimate_minutes}min</span>}
                      </div>
                    </div>

                    <span
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: slaColor.bg, color: slaColor.text }}
                    >
                      {SLA_LABELS[task.sla_status] || task.sla_status}
                    </span>

                    {task.attachment_count > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip size={14} /> {task.attachment_count}
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleEmailTask(task); }}
                      className="text-xs"
                    >
                      <Mail size={14} /> Email
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {emailTask && (
        <EmailComposeModal
          isOpen={showEmailModal}
          onClose={() => { setShowEmailModal(false); setEmailTask(null); }}
          taskId={emailTask.id}
          taskTitle={emailTask.title}
          clientName={client?.name || ''}
          clientEmail={client?.email || ''}
        />
      )}
    </div>
  );
};
