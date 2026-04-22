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
  ChevronDown
} from 'lucide-react';
import { useDashboard } from '../../api/hooks/useDashboard';
import { useTasks } from '../../api/hooks/useTasks';
import { useNotifications } from '../../api/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TaskModal } from '../../components/tasks/TaskModal';
import { TaskResponse } from '../../schemas/tasks';

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

  if (isLoading) {
    return (
      <div className="dashboard-page">
        <div className="panel-skeleton" style={{ height: '32px', width: '300px', marginBottom: '40px' }} />
        <div className="panel-skeleton" style={{ height: '200px', marginBottom: '24px' }} />
        <div className="panel-skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  const handleUpdateStatus = (id: string, status: string) => {
    updateTaskStatus.mutate({ id, status });
    setShowStatusMenu(null);
  };

  const handleViewTask = (task: TaskResponse) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'todo': return 'A Fazer';
      case 'doing': return 'Em Andamento';
      case 'done': return 'Concluído';
      default: return status;
    }
  };

  const handleActivityClick = (activity: any) => {
    markAsRead.mutate(activity.id);
    if (activity.post_id) {
      navigate(`/painel/forum/${activity.post_id}`);
    }
  };

  return (
    <div className="dashboard-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      <div className="panel-content__header" style={{ 
        marginBottom: '48px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <p style={{ 
          fontSize: '11px', 
          fontWeight: 600, 
          letterSpacing: '0.15em', 
          textTransform: 'uppercase', 
          color: 'var(--ds-primary)',
          opacity: 0.8
        }}>Bem-vindo de volta</p>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: 300, 
          color: 'var(--ds-text-primary)',
          letterSpacing: '-0.02em'
        }}>Olá, {summary?.user_name || 'Usuário'}</h1>
      </div>

      {/* Urgent Tasks Section */}
      <section style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <AlertCircle size={16} color="var(--ds-primary)" /> Atenção Imediata
          </h2>
          <Link to="/painel/tarefas" style={{ fontSize: '12px', color: 'var(--ds-primary)', textDecoration: 'none', display: 'flex', gap: '4px', alignItems: 'center' }}>
            Ver todas <ArrowRight size={14} />
          </Link>
        </div>

        <div className="urgent-tasks-rail" style={{ 
          display: 'flex', 
          gap: '16px', 
          overflowX: 'auto', 
          paddingBottom: '16px',
          scrollbarWidth: 'none'
        }}>
          {summary?.urgent_tasks && summary.urgent_tasks.length > 0 ? (
            summary.urgent_tasks.map(task => (
              <div key={task.id} className="ds-card" style={{ 
                minWidth: '320px', 
                padding: '20px', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                borderLeft: '4px solid var(--ds-primary)',
                position: 'relative'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--ds-text-muted)', textTransform: 'uppercase' }}>
                      {task.client_name || 'Cliente'}
                    </div>
                    <button 
                      onClick={() => handleViewTask(task as any)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--ds-text-subtle)', cursor: 'pointer' }}
                      title="Ver Detalhes"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '16px', color: 'var(--ds-text)', lineHeight: 1.4 }}>
                    {task.title}
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ds-warning)', display: 'flex', gap: '4px', alignItems: 'center', fontWeight: 600 }}>
                    <Clock size={12} /> 
                    {task.deadline ? formatDistanceToNow(new Date(task.deadline), { addSuffix: true, locale: ptBR }) : 'Sem prazo'}
                  </div>
                  
                  <div style={{ position: 'relative' }}>
                    <button 
                      onClick={() => setShowStatusMenu(showStatusMenu === task.id ? null : task.id)}
                      className="ds-btn ds-btn-ghost"
                      style={{ 
                        padding: '4px 10px', 
                        fontSize: '11px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '6px',
                        background: 'rgba(255,255,255,0.03)'
                      }}
                    >
                      {getStatusLabel(task.status)} <ChevronDown size={12} />
                    </button>
                    
                    {showStatusMenu === task.id && (
                      <div style={{ 
                        position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px',
                        background: 'var(--ds-surface-3)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 'var(--radius-md)', padding: '4px', zIndex: 10, width: '140px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                      }}>
                        {['todo', 'doing', 'done'].map(s => (
                          <button
                            key={s}
                            onClick={() => handleUpdateStatus(task.id, s)}
                            style={{ 
                              width: '100%', padding: '8px 12px', textAlign: 'left', background: 'transparent',
                              border: 'none', color: task.status === s ? 'var(--ds-primary)' : 'var(--ds-text)',
                              fontSize: '12px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                              fontWeight: task.status === s ? 700 : 400
                            }}
                            className="status-menu-item"
                          >
                            {getStatusLabel(s)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--ds-text-muted)', fontSize: '14px', fontStyle: 'italic', padding: '20px 0' }}>
              Nenhuma tarefa urgente no momento. Bom trabalho!
            </div>
          )}
        </div>
      </section>

      {/* Activity Feed and Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '32px' }}>
        <section>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <MessageSquare size={16} /> Atividade Recente
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {summary?.activities && summary.activities.length > 0 ? (
              summary.activities.map(activity => (
                <div 
                  key={activity.id} 
                  className="orcamento-card" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleActivityClick(activity)}
                >
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ 
                      background: activity.is_read ? 'rgba(255, 255, 255, 0.05)' : 'rgba(251, 191, 36, 0.1)', 
                      padding: '12px', 
                      borderRadius: '14px' 
                    }}>
                      {activity.type === 'comment' ? (
                        <MessageSquare size={20} color={activity.is_read ? 'var(--ds-text-muted)' : 'var(--ds-primary)'} />
                      ) : (
                        <Bell size={20} color="var(--ds-primary)" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', color: 'var(--ds-text)', lineHeight: 1.5, fontWeight: activity.is_read ? 400 : 600 }}>
                        {activity.type === 'comment' ? (
                          <><strong>{activity.triggered_by_name}</strong> respondeu ao seu tópico no fórum</>
                        ) : (
                          <>Notificação do sistema</>
                        )}
                      </div>
                      
                      {activity.message_snippet && (
                        <div style={{ 
                          fontSize: '13px', color: 'var(--ds-text-muted)', marginTop: '8px', 
                          padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)',
                          borderLeft: '3px solid rgba(255,255,255,0.1)', fontStyle: 'italic'
                        }}>
                          "{activity.message_snippet}..."
                        </div>
                      )}
                      
                      <div style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} /> {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="orcamento-card" style={{ 
                padding: '48px 32px', 
                textAlign: 'center', 
                color: 'var(--ds-text-muted)',
                background: 'rgba(255,255,255,0.02)',
                borderStyle: 'dashed'
              }}>
                <div style={{ marginBottom: '16px', opacity: 0.5 }}>
                  <Bell size={40} style={{ margin: '0 auto' }} />
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ds-text)', marginBottom: '8px' }}>
                  Tudo em ordem por aqui!
                </div>
                <div style={{ fontSize: '13px' }}>
                  Você não tem novas notificações no momento. <br/>
                  Aproveite para focar nas suas tarefas ou dar uma olhada no fórum.
                </div>
              </div>
            )}
          </div>
        </section>

        <aside>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
            Resumo Rápido
          </h2>
          <div className="panel-info-card">
            <div className="panel-info-row">
              <span className="panel-info-row__label">Tarefas Pendentes</span>
              <span className="panel-info-row__value">{summary?.stats?.pending_tasks_count || 0}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-row__label">Notificações</span>
              <span className="panel-info-row__value" style={{ color: 'var(--ds-primary)' }}>
                {summary?.stats?.unread_notifications_count || 0} não lidas
              </span>
            </div>
            <div className="panel-info-row" style={{ border: 'none', marginTop: '16px' }}>
              <Link to="/painel/orcamentos" className="ds-btn ds-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Novo Orçamento
              </Link>
            </div>
          </div>

          <div className="panel-calendar" style={{ marginTop: '24px' }}>
            <div className="panel-calendar__header">
              <span className="panel-calendar__title">Calendário</span>
              <CalendarIcon size={14} color="var(--ds-text-muted)" />
            </div>
            <div style={{ fontSize: '11px', textAlign: 'center', padding: '20px', color: 'var(--ds-text-muted)' }}>
              Integração com calendário em breve.
            </div>
          </div>
        </aside>
      </div>

      <TaskModal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        task={selectedTask as any}
      />

      <style dangerouslySetInnerHTML={{ __html: `
        .urgent-tasks-rail::-webkit-scrollbar {
          display: none;
        }
        .dashboard-page h1 {
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.8px;
          color: var(--ds-text);
        }
        .status-menu-item:hover {
          background: rgba(251, 191, 36, 0.1) !important;
          color: var(--ds-primary) !important;
        }
      `}} />
    </div>
  );
};
