import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { DeleteConfirmModal } from '../../components/panel/DeleteConfirmModal';

interface Proposal {
  id: string;
  client_name: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

export const OrcamentosPage: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const navigate = useNavigate();

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const resp = await apiClient.get<Proposal[]>('/api/proposals/');
      setProposals(resp.data);
    } catch (err) {
      console.error('Erro ao carregar propostas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleDeleteClick = (e: React.MouseEvent, proposal: Proposal) => {
    e.stopPropagation();
    setProposalToDelete(proposal);
  };

  const handleConfirmDelete = async () => {
    if (!proposalToDelete) return;
    try {
      await apiClient.delete(`/api/proposals/${proposalToDelete.id}`);
      setProposals(prev => prev.filter(p => p.id !== proposalToDelete.id));
    } catch {
      alert('Erro ao excluir orçamento.');
    } finally {
      setProposalToDelete(null);
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const totalValue = proposals.reduce(
    (sum, p) => sum + (p.result_payload?.final_price || 0),
    0
  );

  // Calendar logic
  const now = new Date();
  const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const prevMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const today = now.getDate();

  const calendarDays: { day: number; isOther: boolean; isToday: boolean }[] = [];
  // Previous month trailing days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, isOther: true, isToday: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({ day: i, isOther: false, isToday: i === today });
  }
  // Next month leading days
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({ day: i, isOther: true, isToday: false });
  }

  return (
    <>
      {/* Breadcrumb Navigation */}
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-primary)' }}>Painel</span>
      </div>

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1>Orçamentos</h1>
          <p>Gerencie e visualize todos os seus orçamentos salvos.</p>
        </div>
        <button 
          className="ds-btn ds-btn-primary" 
          onClick={() => navigate('/painel/novo-orcamento')}
          style={{ gap: '8px' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nova Precificação
        </button>
      </div>

      {/* Stats */}
      <div className="panel-stats">
        <div className="panel-stat">
          <div className="panel-stat__label">Total de Orçamentos</div>
          <div className="panel-stat__value">{loading ? '—' : proposals.length}</div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Valor Total</div>
          <div className="panel-stat__value panel-stat__value--primary">
            {loading ? '—' : formatPrice(totalValue)}
          </div>
        </div>
        <div className="panel-stat">
          <div className="panel-stat__label">Este Mês</div>
          <div className="panel-stat__value">
            {loading
              ? '—'
              : proposals.filter(p => {
                  const d = new Date(p.created_at);
                  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                }).length}
          </div>
        </div>
      </div>

      {/* Grid: List + Info Sidebar */}
      <div className="orcamentos-grid">
        {/* Left - List */}
        <div className="orcamentos-list">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="orcamento-card">
                <div className="orcamento-card__info">
                  <div className="panel-skeleton" style={{ width: '60%', height: '16px', marginBottom: '8px' }} />
                  <div className="panel-skeleton" style={{ width: '40%', height: '12px' }} />
                </div>
                <div className="panel-skeleton" style={{ width: '80px', height: '20px' }} />
              </div>
            ))
          ) : proposals.length === 0 ? (
            <div className="panel-empty">
              <svg className="panel-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <h3>Nenhum orçamento encontrado</h3>
              <p>Comece criando uma simulação na calculadora de preços.</p>
              <button
                className="ds-btn ds-btn-primary"
                onClick={() => navigate('/painel/novo-orcamento')}
              >
                Nova Precificação
              </button>
            </div>
          ) : (
            proposals.map(p => (
              <div
                key={p.id}
                className="orcamento-card"
                onClick={() => navigate(`/painel/editar-orcamento/${p.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter') navigate(`/painel/editar-orcamento/${p.id}`);
                }}
              >
                <div className="orcamento-card__info">
                  <div className="orcamento-card__client">{p.client_name}</div>
                  <div className="orcamento-card__meta">
                    <span>{formatDate(p.created_at)}</span>
                    <span className="orcamento-card__meta-dot" />
                    <span>Proposta salva</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="orcamento-card__price">
                    {formatPrice(p.result_payload?.final_price || 0)}
                  </div>
                  <div className="orcamento-card__actions">
                    <button 
                      className="ds-btn ds-btn-ghost ds-btn-sm" 
                      onClick={(e) => { e.stopPropagation(); navigate(`/painel/editar-orcamento/${p.id}`); }}
                      title="Editar"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      className="orcamento-card__action-btn orcamento-card__action-btn--delete"
                      title="Excluir"
                      onClick={e => handleDeleteClick(e, p)}
                      aria-label="Excluir orçamento"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right - Info Panel */}
        <div className="orcamentos-info">
          {/* Calendar */}
          <div className="panel-calendar">
            <div className="panel-calendar__header">
              <div className="panel-calendar__title" style={{ textTransform: 'capitalize' }}>
                {monthName}
              </div>
              <div className="panel-calendar__nav">
                <button className="panel-calendar__nav-btn" aria-label="Mês anterior">‹</button>
                <button className="panel-calendar__nav-btn" aria-label="Próximo mês">›</button>
              </div>
            </div>
            <div className="panel-calendar__grid">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                <div key={d} className="panel-calendar__day-label">{d}</div>
              ))}
              {calendarDays.map((d, i) => (
                <div
                  key={i}
                  className={`panel-calendar__day ${d.isToday ? 'panel-calendar__day--today' : ''} ${d.isOther ? 'panel-calendar__day--other' : ''}`}
                >
                  {d.day}
                </div>
              ))}
            </div>
          </div>

          {/* Summary Info */}
          <div className="panel-info-card">
            <div className="panel-info-card__title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              Resumo
            </div>
            <div className="panel-info-row">
              <span className="panel-info-row__label">Orçamentos</span>
              <span className="panel-info-row__label">{proposals.length}</span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-row__label">Valor Médio</span>
              <span className="panel-info-row__value panel-info-row__value--primary">
                {proposals.length > 0
                  ? formatPrice(totalValue / proposals.length)
                  : '—'}
              </span>
            </div>
            <div className="panel-info-row">
              <span className="panel-info-row__label">Último Criado</span>
              <span className="panel-info-row__value">
                {proposals.length > 0
                  ? formatDate(proposals[0].created_at)
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmModal 
        isOpen={!!proposalToDelete}
        itemName={proposalToDelete?.client_name}
        onClose={() => setProposalToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
