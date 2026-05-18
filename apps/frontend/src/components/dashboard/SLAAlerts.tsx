import React from 'react';
import { AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useNavigate } from 'react-router-dom';

export const SLAAlerts: React.FC = () => {
  const { useSLAAlerts } = useTasks();
  const { data: alerts, isLoading, refetch } = useSLAAlerts();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="panel-skeleton" style={{ height: '50px' }} />
        <div className="panel-skeleton" style={{ height: '50px' }} />
      </div>
    );
  }

  if (!alerts || (alerts.total_overdue === 0 && alerts.total_warning === 0)) {
    return (
      <div className="ds-card" style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
        <p style={{ fontSize: '14px', color: 'var(--ds-text-muted)' }}>Nenhum alerta de SLA. Todas as tarefas estão em dia!</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700 }}>🚨 Alertas de SLA</h3>
        <button
          onClick={() => refetch()}
          style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}
          title="Atualizar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Overdue alerts */}
      {alerts.overdue.map((alert, idx) => (
        <div
          key={`overdue-${idx}`}
          className="ds-card"
          style={{
            padding: '12px 16px', cursor: 'pointer',
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
            transition: 'all 0.2s',
          }}
          onClick={() => navigate('/painel/tarefas')}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#ef4444' }}>{alert.message}</div>
              <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', marginTop: '4px' }}>
                {alert.tasks.map(t => t.title).join(', ')}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Warning alerts */}
      {alerts.warning.map((alert, idx) => (
        <div
          key={`warning-${idx}`}
          className="ds-card"
          style={{
            padding: '12px 16px', cursor: 'pointer',
            background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)',
            transition: 'all 0.2s',
          }}
          onClick={() => navigate('/painel/tarefas')}
        >
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#f59e0b' }}>{alert.message}</div>
              <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', marginTop: '4px' }}>
                {alert.tasks.map(t => t.title).join(', ')}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
