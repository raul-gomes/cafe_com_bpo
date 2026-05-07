import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';

interface Simulation {
  id: string;
  roi_percentage: number;
  net_savings: number;
  payback_months: number;
  annual_savings: number;
  created_at: string;
}

export const RoiHistoricoPage: React.FC = () => {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchSimulations = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await apiClient.get<Simulation[]>('/roi/simulations');
      setSimulations(resp.data);
    } catch (err) {
      console.error('Erro ao carregar simulações:', err);
      setError('Não foi possível carregar as simulações. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulations();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta simulação?')) return;
    try {
      await apiClient.delete(`/roi/simulations/${id}`);
      setSimulations(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao excluir simulação.');
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <>
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Histórico ROI' }]} />

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1>Histórico de Simulações ROI</h1>
          <p>Visualize todas as suas simulações de retorno sobre investimento.</p>
        </div>
        <button
          className="ds-btn ds-btn-primary"
          onClick={() => navigate('/painel/roi-calculadora')}
          style={{ gap: '8px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Simulação
        </button>
      </div>

      {/* Stats */}
      {error ? (
        <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--ds-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px', opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Erro ao carregar</h3>
          <p style={{ color: 'var(--ds-text-muted)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>{error}</p>
          <button className="ds-btn ds-btn-primary" onClick={fetchSimulations}>Tentar Novamente</button>
        </div>
      ) : (
        <>
          <div className="panel-stats">
            <div className="panel-stat">
              <div className="panel-stat__label">Total de Simulações</div>
              <div className="panel-stat__value">{loading ? '—' : simulations.length}</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat__label">Melhor ROI</div>
              <div className="panel-stat__value panel-stat__value--primary">
                {loading ? '—' : simulations.length > 0 ? `${Math.max(...simulations.map(s => s.roi_percentage)).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat__label">Economia Total</div>
              <div className="panel-stat__value">
                {loading ? '—' : formatPrice(simulations.reduce((sum, s) => sum + s.annual_savings, 0))}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="orcamentos-list" style={{ marginTop: '24px' }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="orcamento-card">
                  <div className="orcamento-card__info">
                    <div className="panel-skeleton" style={{ width: '40%', height: '16px', marginBottom: '8px' }} />
                    <div className="panel-skeleton" style={{ width: '30%', height: '12px' }} />
                  </div>
                  <div className="panel-skeleton" style={{ width: '80px', height: '20px' }} />
                </div>
              ))
            ) : simulations.length === 0 ? (
              <div className="panel-empty">
                <svg className="panel-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
                <h3>Nenhuma simulação encontrada</h3>
                <p>Comece criando uma simulação na calculadora de ROI.</p>
                <button
                  className="ds-btn ds-btn-primary"
                  onClick={() => navigate('/painel/roi-calculadora')}
                >
                  Nova Simulação
                </button>
              </div>
            ) : (
              simulations.map(s => (
                <div key={s.id} className="roi-simulation-card">
                  <div className="roi-simulation-card__info">
                    <div className="roi-simulation-card__roi">
                      <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>ROI</span>
                      <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ds-primary)' }}>
                        {s.roi_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="roi-simulation-card__meta">
                      <span>{formatDate(s.created_at)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="roi-simulation-card__savings">
                      <span style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>Economia Anual</span>
                      <div style={{ fontSize: '16px', fontWeight: 600 }}>
                        {formatPrice(s.annual_savings)}
                      </div>
                    </div>
                    <div className="roi-simulation-card__payback">
                      <span style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>Payback</span>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>
                        {s.payback_months >= 999 ? '> 999m' : `${s.payback_months.toFixed(1)}m`}
                      </div>
                    </div>
                    <button
                      className="orcamento-card__action-btn orcamento-card__action-btn--delete"
                      title="Excluir"
                      onClick={() => handleDelete(s.id)}
                      aria-label="Excluir simulação"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
};
