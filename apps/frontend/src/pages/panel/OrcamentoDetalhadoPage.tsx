import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import logoAsset from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../api/client';
import { getClients, ClientData } from '../../api/clients';

interface Proposal {
  id: string;
  client_name: string;
  input_payload: any;
  result_payload: any;
  created_at: string;
}

export const OrcamentoDetalhadoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generate: generatePDF } = useGeneratePDF();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [proposalResp, clientsResp] = await Promise.all([
        apiClient.get<Proposal>(`/api/proposals/${id}`),
        getClients()
      ]);
      setProposal(proposalResp.data);
      setClients(clientsResp);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  const handlePrint = async () => {
    if (!proposal) return;
    
    // Fix: Se a avatar_url já for um link absoluto (Cloudinary), não concatenamos com getApiUrl()
    const avatarUrl = user?.avatar_url;
    const finalLogoUrl = avatarUrl 
      ? (avatarUrl.startsWith('http') ? avatarUrl : `${getApiUrl()}${avatarUrl}`) 
      : logoAsset;

    // Busca o email do cliente correspondente
    const client = clients.find(c => c.name.trim().toLowerCase() === proposal.client_name.trim().toLowerCase());

    await generatePDF({
      form: proposal.input_payload,
      pricing: proposal.result_payload,
      logoUrl: finalLogoUrl,
      clientName: proposal.client_name,
      clientEmail: client?.email || '', // Passa o email do cliente encontrado
      provider: user
    });
  };

  const handleEmail = () => {
    if (!proposal) return;
    const subject = encodeURIComponent(`Orçamento Café com BPO - ${proposal.client_name}`);
    const body = encodeURIComponent(`Olá, segue o orçamento detalhado...\n\nTotal: ${formatPrice(proposal.result_payload?.final_price || 0)}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleWhatsApp = () => {
    if (!proposal) return;
    const text = encodeURIComponent(`Olá! Segue o detalhamento do seu orçamento no Café com BPO.\n\n*Cliente:* ${proposal.client_name}\n*Total:* ${formatPrice(proposal.result_payload?.final_price || 0)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  if (loading) {
    return (
      <div className="detalhe-page">
        <div className="detalhe-header">
            <div className="panel-skeleton" style={{ width: '200px', height: '32px' }} />
        </div>
        <div className="detalhe-grid">
            <div className="panel-skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
            <div className="panel-skeleton" style={{ height: '300px', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
        <div className="panel-empty">
            <h3>Orçamento não encontrado</h3>
            <button className="ds-btn ds-btn-primary" onClick={() => navigate('/painel')}>
                Voltar para Orçamentos
            </button>
        </div>
    );
  }

  const result = proposal.result_payload || {};

  return (
    <div className="detalhe-page">
      {/* Breadcrumb Navigation */}
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-text-muted)', cursor: 'pointer' }} onClick={() => navigate('/painel')}>Painel</span>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Orçamento Detalhado</span>
      </div>

      <div className="detalhe-header">
        <div>
          <h1 style={{ marginTop: '8px' }}>{proposal.client_name}</h1>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: '13px' }}>Criado em {formatDate(proposal.created_at)}</p>
        </div>

        <div className="detalhe-header__actions">
          <button className="detalhe-action-btn" style={{ background: 'var(--ds-primary)', color: 'var(--ds-primary-text)', borderColor: 'var(--ds-primary)' }} onClick={() => navigate(`/painel/editar-orcamento/${id}`)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar Orçamento
          </button>
          <button className="detalhe-action-btn detalhe-action-btn--print" onClick={handlePrint}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimir PDF
          </button>
          <button className="detalhe-action-btn detalhe-action-btn--email" onClick={handleEmail}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            E-mail
          </button>
          <button className="detalhe-action-btn detalhe-action-btn--whatsapp" onClick={handleWhatsApp}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 11-7.6-10.3c.4 0 .7.3.7.7S12.9 6.4 12.5 6.4a7 7 0 106.3 8.3 7 7 0 00.7-3.2c0-.4.3-.7.7-.7s.8.3.8.7z"/>
                <path d="M17.5 13.5l1.5-1.5-1.5-1.5"/>
            </svg>
            WhatsApp
          </button>
        </div>
      </div>

      <div className="detalhe-grid">
        {/* Card Resumo Financeiro */}
        <div className="detalhe-card">
          <div className="detalhe-card__title">Resumo Financeiro</div>
          <div className="detalhe-card__value-large">{formatPrice(result.final_price || 0)}</div>
          <div className="detalhe-card__value-sub">Valor mensal estimado</div>

          <div className="detalhe-breakdown" style={{ marginTop: '24px' }}>
            {result.breakdown ? (
              <>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Custo Operacional</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.total_service_cost || 0)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Margem de Lucro</span>
                  <span className="detalhe-breakdown__value">+{formatPrice(result.breakdown.profit_amount || 0)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Impostos / Comissões</span>
                  <span className="detalhe-breakdown__value">+{formatPrice(result.breakdown.tax_amount || 0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Base de Cálculo</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.base_price || 0)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Complexidade ({proposal.input_payload?.complexity || 'N/A'})</span>
                  <span className="detalhe-breakdown__value">x {result.complexity_multiplier?.toFixed(2) || '1.00'}</span>
                </div>
              </>
            )}
            <div className="detalhe-breakdown__divider" />
            <div className="detalhe-breakdown__row--total">
              <span className="detalhe-breakdown__label">Total Sugerido</span>
              <span className="detalhe-breakdown__value">{formatPrice(result.final_price || 0)}</span>
            </div>
          </div>
        </div>

        {/* Card Escopo do Serviço */}
        <div className="detalhe-card">
          <div className="detalhe-card__title">Escopo do Serviço</div>
          <div className="detalhe-breakdown">
             {proposal.input_payload?.services?.map((service: any, idx: number) => {
                const serviceName = typeof service === 'object' ? service.name : service;
                const isActive = typeof service === 'object' ? service.active : true;
                
                if (!isActive && typeof service === 'object') return null;

                return (
                  <div key={idx} className="detalhe-breakdown__row">
                      <span className="detalhe-breakdown__label">
                          <span style={{ color: 'var(--ds-primary)', marginRight: '8px' }}>✓</span>
                          {serviceName}
                      </span>
                  </div>
                );
             })}
             {!proposal.input_payload?.services && <p className="detalhe-breakdown__label">Lista de serviços não informada.</p>}
          </div>
        </div>

        {/* Card Dados do Cliente */}
        <div className="detalhe-card detalhe-card--full">
           <div className="detalhe-card__title">Dados do Cliente e Simulação</div>
            <div className="perfil-form">
                <div className="ds-input-group">
                    <label className="ds-label">Empresa</label>
                    <div className="ds-input" style={{ background: 'rgba(255,255,255,0.03)', border: 'none' }}>
                        {proposal.client_name}
                    </div>
                </div>
                {proposal.input_payload?.operation ? (
                  <>
                    <div className="ds-input-group">
                        <label className="ds-label">Custo Operacional Mensal</label>
                        <div className="ds-input" style={{ background: 'rgba(255,255,255,0.03)', border: 'none' }}>
                            {formatPrice(proposal.input_payload.operation.total_cost || 0)}
                        </div>
                    </div>
                    <div className="ds-input-group">
                        <label className="ds-label">Capacidade (Horas/Mês)</label>
                        <div className="ds-input" style={{ background: 'rgba(255,255,255,0.03)', border: 'none' }}>
                            {(proposal.input_payload.operation.people_count * proposal.input_payload.operation.hours_per_month) || 0}h
                        </div>
                    </div>
                    <div className="ds-input-group">
                        <label className="ds-label">Margem Desejada</label>
                        <div className="ds-input" style={{ background: 'rgba(255,255,255,0.03)', border: 'none' }}>
                            {(proposal.input_payload.desired_profit_margin * 100).toFixed(0)}%
                        </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ds-input-group">
                        <label className="ds-label">Complexidade</label>
                        <div className="ds-input" style={{ background: 'rgba(255,255,255,0.03)', border: 'none' }}>
                            {proposal.input_payload?.complexity || 'Não informado'}
                        </div>
                    </div>
                    <div className="ds-input-group">
                        <label className="ds-label">Faturamento Mensal</label>
                        <div className="ds-input" style={{ background: 'rgba(255,255,255,0.03)', border: 'none' }}>
                            {formatPrice(proposal.input_payload?.revenue || 0)}
                        </div>
                    </div>
                  </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
