import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar, Mail, Paperclip, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { ClientTimelineTask } from '../../schemas/tasks';
import { EmailComposeModal } from '../../components/tasks/EmailComposeModal';

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
    <div className="tasks-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      <Breadcrumb items={[
        { label: 'Painel', to: '/painel' },
        { label: 'Empresas', to: '/painel/empresas' },
        { label: client?.name || 'Timeline' },
      ]} />

      <div style={{ marginBottom: '16px' }}>
        <button className="ds-btn ds-btn-ghost" onClick={() => navigate('/painel/empresas')} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>

      {/* Client header */}
      <div className="panel-content__header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>{client?.name || 'Carregando...'}</h1>
          <p style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Calendar size={14} /> Timeline de Entregas
            {client?.email && <span style={{ color: 'var(--ds-text-muted)' }}>• {client.email}</span>}
          </p>
        </div>
      </div>

      {timeline && (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, padding: '14px', background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>{timeline.stats.on_time}</div>
              <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>No prazo</div>
            </div>
            <div style={{ flex: 1, padding: '14px', background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{timeline.stats.warning}</div>
              <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>⚠️ Próximas</div>
            </div>
            <div style={{ flex: 1, padding: '14px', background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{timeline.stats.overdue}</div>
              <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>🔴 Atrasadas</div>
            </div>
            <div style={{ flex: 1, padding: '14px', background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ds-primary)' }}>{timeline.stats.in_progress}</div>
              <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>Em andamento</div>
            </div>
          </div>

          {/* SLA configs */}
          {timeline.slas.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              {timeline.slas.map((sla, idx) => (
                <span key={idx} style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', color: 'var(--ds-primary)', fontSize: '12px', fontWeight: 700 }}>
                  SLA: {sla.process_type} — {sla.sla_days}d
                </span>
              ))}
            </div>
          )}

          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
            <button onClick={goPrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-muted)' }}>
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '16px', fontWeight: 700, textTransform: 'capitalize', color: 'var(--ds-text)' }}>
              {formatMonth(currentMonth)}
            </span>
            <button onClick={goNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-muted)' }}>
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Tasks */}
          {timeline.tasks.length === 0 ? (
            <div className="panel-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Calendar size={40} style={{ color: 'var(--ds-text-muted)', opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ color: 'var(--ds-text-muted)' }}>Nenhuma tarefa para este mês.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {timeline.tasks.map(task => {
                const slaColor = SLA_COLORS[task.sla_status] || SLA_COLORS.on_time;
                const SLAIcon = slaColor.icon;
                return (
                  <div
                    key={task.id}
                    className="ds-card"
                    style={{
                      padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px',
                      borderLeft: `4px solid ${slaColor.text}`,
                      background: task.sla_status === 'overdue' ? 'rgba(239,68,68,0.03)' : 'var(--ds-surface)',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/painel/tarefas`, { state: { taskId: task.id } })}
                  >
                    <SLAIcon size={18} style={{ color: slaColor.text, flexShrink: 0 }} />
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                        {task.deadline && (
                          <span>📅 {new Date(task.deadline).toLocaleDateString('pt-BR')}</span>
                        )}
                        {task.process_type && (
                          <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.08)', color: 'var(--ds-primary)', fontWeight: 600 }}>{task.process_type}</span>
                        )}
                        {task.time_estimate_hours && <span>⏱ {task.time_estimate_hours}h</span>}
                      </div>
                    </div>

                    <span style={{
                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '12px',
                      background: slaColor.bg, color: slaColor.text, whiteSpace: 'nowrap',
                    }}>
                      {SLA_LABELS[task.sla_status] || task.sla_status}
                    </span>

                    {task.attachment_count > 0 && (
                      <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Paperclip size={14} /> {task.attachment_count}
                      </span>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleEmailTask(task); }}
                      className="ds-btn ds-btn-ghost ds-btn-sm"
                      title="Enviar por email"
                      style={{ fontSize: '12px' }}
                    >
                      <Mail size={14} /> Email
                    </button>
                  </div>
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
