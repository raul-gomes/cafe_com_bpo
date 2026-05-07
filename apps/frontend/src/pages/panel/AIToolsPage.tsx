import React, { useState } from 'react';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Brain, FileText, Megaphone, Copy, Sparkles } from 'lucide-react';

type TabType = 'budget' | 'contract' | 'sales';

export const AIToolsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('budget');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const [budgetForm, setBudgetForm] = useState({
    client_name: '',
    services: '',
    final_price: '',
  });

  const [contractForm, setContractForm] = useState({
    provider_name: '',
    provider_company: '',
    client_name: '',
    services: '',
    monthly_fee: '',
    contract_duration_months: '12',
    penalty_clause: '',
    additional_terms: '',
  });

  const [salesForm, setSalesForm] = useState({
    service_type: '',
    target_audience: '',
    client_pain_points: '',
    proposed_solution: '',
    monthly_price: '',
    competitor_info: '',
  });

  const handleBudgetAnalyze = async () => {
    if (!budgetForm.client_name || !budgetForm.services || !budgetForm.final_price) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    try {
      setLoading(true);
      setResult(null);
      const { data } = await apiClient.post('/ai/analyze-budget', {
        client_name: budgetForm.client_name,
        services: budgetForm.services.split(',').map(s => s.trim()).filter(Boolean),
        final_price: parseFloat(budgetForm.final_price.replace(/[^\d,]/g, '').replace(',', '.')),
      });
      setResult(data.analysis);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao analisar orçamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleContractGenerate = async () => {
    if (!contractForm.provider_name || !contractForm.client_name || !contractForm.services || !contractForm.monthly_fee) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    try {
      setLoading(true);
      setResult(null);
      const { data } = await apiClient.post('/ai/generate-contract', {
        ...contractForm,
        services: contractForm.services.split(',').map(s => s.trim()).filter(Boolean),
        monthly_fee: parseFloat(contractForm.monthly_fee.replace(/[^\d,]/g, '').replace(',', '.')),
        contract_duration_months: parseInt(contractForm.contract_duration_months),
      });
      setResult(data.contract);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao gerar contrato.');
    } finally {
      setLoading(false);
    }
  };

  const handleSalesScriptGenerate = async () => {
    if (!salesForm.service_type || !salesForm.target_audience || !salesForm.client_pain_points) {
      alert('Preencha todos os campos obrigatórios.');
      return;
    }
    try {
      setLoading(true);
      setResult(null);
      const { data } = await apiClient.post('/ai/generate-sales-script', {
        ...salesForm,
        client_pain_points: salesForm.client_pain_points.split('\n').map(s => s.trim()).filter(Boolean),
        monthly_price: parseFloat(salesForm.monthly_price.replace(/[^\d,]/g, '').replace(',', '.')) || 0,
      });
      setResult(data.script);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao gerar roteiro.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      alert('Conteúdo copiado para a área de transferência!');
    }
  };

  const renderForm = () => {
    switch (activeTab) {
      case 'budget':
        return (
          <>
            <div className="ds-input-group">
              <label className="ds-label">Nome do Cliente *</label>
              <input className="ds-input" value={budgetForm.client_name} onChange={e => setBudgetForm(p => ({ ...p, client_name: e.target.value }))} placeholder="Ex: Empresa ABC" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Serviços (separados por vírgula) *</label>
              <input className="ds-input" value={budgetForm.services} onChange={e => setBudgetForm(p => ({ ...p, services: e.target.value }))} placeholder="Ex: Contabilidade, Fiscal, DP" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Valor Final (R$) *</label>
              <input className="ds-input" value={budgetForm.final_price} onChange={e => setBudgetForm(p => ({ ...p, final_price: e.target.value }))} placeholder="R$ 0,00" />
            </div>
            <button className="ds-btn ds-btn-primary" onClick={handleBudgetAnalyze} disabled={loading} style={{ width: '100%', gap: '8px' }}>
              <Sparkles size={18} /> {loading ? 'Analisando...' : 'Analisar Orçamento'}
            </button>
          </>
        );
      case 'contract':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="ds-input-group">
                <label className="ds-label">Seu Nome *</label>
                <input className="ds-input" value={contractForm.provider_name} onChange={e => setContractForm(p => ({ ...p, provider_name: e.target.value }))} />
              </div>
              <div className="ds-input-group">
                <label className="ds-label">Sua Empresa *</label>
                <input className="ds-input" value={contractForm.provider_company} onChange={e => setContractForm(p => ({ ...p, provider_company: e.target.value }))} />
              </div>
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Nome do Cliente *</label>
              <input className="ds-input" value={contractForm.client_name} onChange={e => setContractForm(p => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Serviços (separados por vírgula) *</label>
              <input className="ds-input" value={contractForm.services} onChange={e => setContractForm(p => ({ ...p, services: e.target.value }))} placeholder="Ex: Contabilidade, Fiscal, DP" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="ds-input-group">
                <label className="ds-label">Valor Mensal (R$) *</label>
                <input className="ds-input" value={contractForm.monthly_fee} onChange={e => setContractForm(p => ({ ...p, monthly_fee: e.target.value }))} placeholder="R$ 0,00" />
              </div>
              <div className="ds-input-group">
                <label className="ds-label">Duração (meses)</label>
                <input className="ds-input" type="number" value={contractForm.contract_duration_months} onChange={e => setContractForm(p => ({ ...p, contract_duration_months: e.target.value }))} min="1" />
              </div>
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Cláusula de Multa (opcional)</label>
              <textarea className="ds-input" rows={2} value={contractForm.penalty_clause} onChange={e => setContractForm(p => ({ ...p, penalty_clause: e.target.value }))} placeholder="Deixe em branco para usar o padrão" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Termos Adicionais (opcional)</label>
              <textarea className="ds-input" rows={2} value={contractForm.additional_terms} onChange={e => setContractForm(p => ({ ...p, additional_terms: e.target.value }))} />
            </div>
            <button className="ds-btn ds-btn-primary" onClick={handleContractGenerate} disabled={loading} style={{ width: '100%', gap: '8px' }}>
              <FileText size={18} /> {loading ? 'Gerando...' : 'Gerar Contrato'}
            </button>
          </>
        );
      case 'sales':
        return (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="ds-input-group">
                <label className="ds-label">Tipo de Serviço *</label>
                <input className="ds-input" value={salesForm.service_type} onChange={e => setSalesForm(p => ({ ...p, service_type: e.target.value }))} placeholder="Ex: BPO Contábil" />
              </div>
              <div className="ds-input-group">
                <label className="ds-label">Público-alvo *</label>
                <input className="ds-input" value={salesForm.target_audience} onChange={e => setSalesForm(p => ({ ...p, target_audience: e.target.value }))} placeholder="Ex: Pequenas empresas de tecnologia" />
              </div>
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Dores do Cliente (uma por linha) *</label>
              <textarea className="ds-input" rows={3} value={salesForm.client_pain_points} onChange={e => setSalesForm(p => ({ ...p, client_pain_points: e.target.value }))} placeholder="Ex: Alto custo com equipe interna&#10;Erros na apuração de impostos" />
            </div>
            <div className="ds-input-group">
              <label className="ds-label">Solução Proposta *</label>
              <textarea className="ds-input" rows={2} value={salesForm.proposed_solution} onChange={e => setSalesForm(p => ({ ...p, proposed_solution: e.target.value }))} placeholder="Descreva como seu BPO resolve as dores" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="ds-input-group">
                <label className="ds-label">Preço Mensal (R$)</label>
                <input className="ds-input" value={salesForm.monthly_price} onChange={e => setSalesForm(p => ({ ...p, monthly_price: e.target.value }))} placeholder="R$ 0,00" />
              </div>
              <div className="ds-input-group">
                <label className="ds-label">Informações sobre Concorrentes (opcional)</label>
                <input className="ds-input" value={salesForm.competitor_info} onChange={e => setSalesForm(p => ({ ...p, competitor_info: e.target.value }))} />
              </div>
            </div>
            <button className="ds-btn ds-btn-primary" onClick={handleSalesScriptGenerate} disabled={loading} style={{ width: '100%', gap: '8px' }}>
              <Megaphone size={18} /> {loading ? 'Gerando...' : 'Gerar Roteiro'}
            </button>
          </>
        );
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Ferramentas IA' }]} />

      <div className="panel-content__header">
        <div>
          <h1>Ferramentas de IA</h1>
          <p>Use inteligência artificial para analisar orçamentos, gerar contratos e criar roteiros de vendas.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', animation: 'panelFadeIn 0.4s ease-out' }}>
        {/* Form Panel */}
        <div className="ds-card" style={{ padding: '24px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[
              { id: 'budget' as TabType, icon: <Brain size={16} />, label: 'Análise de Orçamento' },
              { id: 'contract' as TabType, icon: <FileText size={16} />, label: 'Gerar Contrato' },
              { id: 'sales' as TabType, icon: <Megaphone size={16} />, label: 'Roteiro de Vendas' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setResult(null); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
                  background: activeTab === tab.id ? 'var(--ds-primary)' : 'rgba(255,255,255,0.04)',
                  color: activeTab === tab.id ? 'var(--ds-primary-text)' : 'var(--ds-text-muted)',
                  border: activeTab === tab.id ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {renderForm()}
        </div>

        {/* Result Panel */}
        <div className="ds-card" style={{ padding: '24px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Resultado
            </h3>
            {result && (
              <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: 'var(--ds-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                <Copy size={14} /> Copiar
              </button>
            )}
          </div>

          {!result ? (
            <div className="panel-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <Sparkles size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                <p style={{ color: 'var(--ds-text-muted)', fontSize: '14px' }}>
                  Preencha o formulário e clique em gerar para ver o resultado aqui.
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              flex: 1, overflow: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)',
              padding: '20px', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {result}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
