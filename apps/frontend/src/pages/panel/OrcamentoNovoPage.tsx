import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PricingCalculatorLayout } from '../../components/pricing/PricingCalculatorLayout';
import { apiClient } from '../../api/client';
import { calculatePricing } from '../../lib/pricingEngine';
import { PricingFormData } from '../../schemas/pricing';

export const OrcamentoNovoPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState<PricingFormData | undefined>(undefined);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchProposal = async () => {
        try {
          const resp = await apiClient.get(`/api/proposals/${id}`);
          setInitialData(resp.data.input_payload);
          setClientName(resp.data.client_name);
        } catch (err) {
          console.error('Erro ao carregar orçamento:', err);
          alert('Não foi possível carregar o orçamento.');
          navigate('/painel');
        } finally {
          setLoading(false);
        }
      };
      fetchProposal();
    } else {
      // Se não há ID, verifica se há uma simulação pendente no sessionStorage
      const raw = sessionStorage.getItem('cafe_bpo_proposal');
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved.form) {
            setInitialData(saved.form);
            setClientName(saved.clientName || '');
            // Opcional: remover da sessão após carregar? 
            // Melhor manter para evitar perda em refresh antes de salvar.
          }
        } catch (e) {
          console.error('Erro ao carregar simulação pendente:', e);
        }
      }
      setLoading(false);
    }
  }, [id, navigate]);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (formData: PricingFormData, name: string) => {
    try {
      setSaving(true);
      
      const result = calculatePricing(
        formData.operation,
        formData.services,
        formData.desired_profit_margin,
        formData.term_discount
      );

      const payload = {
        client_name: name,
        input_payload: formData,
        result_payload: result
      };

      if (id) {
        await apiClient.put(`/api/proposals/${id}`, payload);
      } else {
        await apiClient.post('/api/proposals/', payload);
      }

      showToast('Orçamento salvo com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      showToast('Erro ao salvar orçamento. Tente novamente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="panel-loading">
        <div className="panel-skeleton" style={{ width: '100%', height: '400px' }} />
      </div>
    );
  }

  return (
    <div className="orcamento-novo-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      {/* Toast Notification */}
      {toast && (
        <div className="ds-toast-container">
          <div className={`ds-toast ds-toast--${toast.type}`}>
            <div className="ds-toast__icon">
              {toast.type === 'success' ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ds-primary)' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ef4444' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>
            <div className="ds-toast__content">{toast.message}</div>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <Link to="/painel" style={{ color: 'var(--ds-text-muted)', textDecoration: 'none' }}>Painel</Link>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>{id ? 'Editar Orçamento' : 'Nova Precificação'}</span>
      </div>

      <div className="panel-content__header" style={{ marginBottom: '28px' }}>
        <div>
          <h1>{id ? 'Editar Orçamento' : 'Nova Precificação'}</h1>
          <p>{id ? `Editando orçamento de ${clientName}` : 'Preencha os dados abaixo para gerar um novo orçamento detalhado.'}</p>
        </div>
      </div>

      <div className="panel-card" style={{ padding: '0', background: 'transparent', border: 'none' }}>
        <PricingCalculatorLayout 
          initialData={initialData}
          initialClientName={clientName}
          onSave={handleSave}
          isSaving={saving}
          saveButtonLabel={id ? 'Salvar Alterações' : 'Criar Orçamento'}
        />
      </div>
    </div>
  );
};
