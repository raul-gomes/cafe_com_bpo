import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { maskCurrency, parseCurrencyInput } from '../../lib/formatters';

interface RoiInput {
  current_monthly_cost: number;
  bpo_monthly_cost: number;
  employees_count: number;
  hourly_rate: number;
  error_rate_pct: number;
  productivity_gain_pct: number;
  timeframe_months: number;
}

interface RoiBreakdown {
  current_annual_cost: number;
  bpo_annual_cost: number;
  error_cost_savings: number;
  productivity_value: number;
  total_annual_savings: number;
  investment: number;
  net_savings: number;
  roi_percentage: number;
  payback_months: number;
}

interface RoiResult {
  breakdown: RoiBreakdown;
  monthly_savings: number;
  annual_savings: number;
  roi_percentage: number;
  payback_months: number;
}

export const RoiCalculatorPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<RoiResult | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [form, setForm] = useState<RoiInput>({
    current_monthly_cost: 0,
    bpo_monthly_cost: 0,
    employees_count: 1,
    hourly_rate: 50,
    error_rate_pct: 0,
    productivity_gain_pct: 0,
    timeframe_months: 12,
  });

  const updateField = useCallback((field: keyof RoiInput, value: string) => {
    setForm(prev => {
      const numValue = field === 'employees_count' || field === 'timeframe_months'
        ? parseInt(value.replace(/\D/g, '')) || 0
        : parseCurrencyInput(value);
      return { ...prev, [field]: numValue };
    });
  }, []);

  const handleCalculate = async (withExplanation: boolean) => {
    if (form.current_monthly_cost <= 0 || form.bpo_monthly_cost <= 0) {
      alert('Preencha pelo menos o custo operacional atual e o custo com BPO.');
      return;
    }

    try {
      setLoading(true);
      setCalculating(withExplanation);
      setResult(null);
      setExplanation(null);

      const endpoint = withExplanation
        ? '/roi/calculate-with-explanation'
        : '/roi/calculate';

      const { data } = await apiClient.post(endpoint, form);

      if (withExplanation) {
        setResult(data.result);
        setExplanation(data.explanation);
      } else {
        setResult(data);
        setExplanation(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao calcular ROI.');
    } finally {
      setLoading(false);
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await apiClient.post('/roi/save', {
        input_data: form,
        result_data: result,
        llm_explanation: explanation,
      });
      alert('Simulação salva com sucesso!');
      navigate('/painel/roi-historico');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao salvar simulação.');
    }
  };

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return (
    <>
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Calculadora ROI' }]} />

      <div className="panel-content__header">
        <div>
          <h1>Calculadora de ROI</h1>
          <p>Simule o retorno sobre investimento ao migrar para BPO.</p>
        </div>
      </div>

      <div className="roi-calculator-shell">
        {/* Form */}
        <div className="roi-calculator__form">
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>
            Dados da Operação
          </h2>

          <div className="ds-input-group">
            <label className="ds-label">Custo Operacional Atual (Mensal)</label>
            <input
              type="text"
              className="ds-input"
              value={maskCurrency(String(form.current_monthly_cost))}
              onChange={e => updateField('current_monthly_cost', e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>

          <div className="ds-input-group">
            <label className="ds-label">Custo com BPO Proposto (Mensal)</label>
            <input
              type="text"
              className="ds-input"
              value={maskCurrency(String(form.bpo_monthly_cost))}
              onChange={e => updateField('bpo_monthly_cost', e.target.value)}
              placeholder="R$ 0,00"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-input-group">
              <label className="ds-label">Funcionários Envolvidos</label>
              <input
                type="number"
                className="ds-input"
                value={form.employees_count}
                onChange={e => updateField('employees_count', e.target.value)}
                min="1"
              />
            </div>

            <div className="ds-input-group">
              <label className="ds-label">Custo Hora Médio (R$)</label>
              <input
                type="number"
                className="ds-input"
                value={form.hourly_rate}
                onChange={e => updateField('hourly_rate', e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ds-input-group">
              <label className="ds-label">Taxa de Erro Atual (%)</label>
              <input
                type="number"
                className="ds-input"
                value={form.error_rate_pct}
                onChange={e => updateField('error_rate_pct', e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>

            <div className="ds-input-group">
              <label className="ds-label">Ganho de Produtividade (%)</label>
              <input
                type="number"
                className="ds-input"
                value={form.productivity_gain_pct}
                onChange={e => updateField('productivity_gain_pct', e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>

          <div className="ds-input-group">
            <label className="ds-label">Período de Análise (meses)</label>
            <input
              type="number"
              className="ds-input"
              value={form.timeframe_months}
              onChange={e => updateField('timeframe_months', e.target.value)}
              min="1"
              max="60"
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              className="ds-btn ds-btn-primary"
              disabled={loading}
              onClick={() => handleCalculate(false)}
              style={{ flex: 1 }}
            >
              {loading && !calculating ? 'Calculando...' : 'Calcular ROI'}
            </button>
            <button
              className="ds-btn ds-btn-secondary"
              disabled={loading}
              onClick={() => handleCalculate(true)}
              style={{ flex: 1 }}
            >
              {loading && calculating ? 'Gerando análise...' : 'Calcular com IA'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="roi-calculator__results">
          {!result ? (
            <div className="panel-empty" style={{ minHeight: '300px' }}>
              <svg className="panel-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              <h3>Simulação de ROI</h3>
              <p>Preencha os dados da sua operação e clique em calcular para ver os resultados.</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>
                Resultado da Simulação
              </h2>

              {/* Main Metrics */}
              <div className="roi-metrics">
                <div className="roi-metric">
                  <div className="roi-metric__label">ROI</div>
                  <div className="roi-metric__value roi-metric__value--primary">
                    {result.roi_percentage.toFixed(1)}%
                  </div>
                </div>
                <div className="roi-metric">
                  <div className="roi-metric__label">Economia Anual</div>
                  <div className="roi-metric__value">
                    {formatPrice(result.annual_savings)}
                  </div>
                </div>
                <div className="roi-metric">
                  <div className="roi-metric__label">Payback</div>
                  <div className="roi-metric__value">
                    {result.payback_months >= 999 ? '> 999 meses' : `${result.payback_months.toFixed(1)} meses`}
                  </div>
                </div>
                <div className="roi-metric">
                  <div className="roi-metric__label">Economia Mensal</div>
                  <div className="roi-metric__value">
                    {formatPrice(result.monthly_savings)}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="roi-breakdown" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--ds-text-muted)' }}>
                  Detalhamento
                </h3>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Custo Atual Anual</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.current_annual_cost)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Custo BPO Anual</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.bpo_annual_cost)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Economia por Erros</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.error_cost_savings)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Valor da Produtividade</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.productivity_value)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Economia Total Anual</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.total_annual_savings)}</span>
                </div>
                <div className="detalhe-breakdown__row">
                  <span className="detalhe-breakdown__label">Investimento</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.investment)}</span>
                </div>
                <div className="detalhe-breakdown__divider" />
                <div className="detalhe-breakdown__row--total">
                  <span className="detalhe-breakdown__label">Economia Líquida</span>
                  <span className="detalhe-breakdown__value">{formatPrice(result.breakdown.net_savings)}</span>
                </div>
              </div>

              {/* LLM Explanation */}
              {explanation && (
                <div className="roi-llm-explanation" style={{ marginTop: '24px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--ds-text-muted)' }}>
                    Análise da IA
                  </h3>
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--ds-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {explanation}
                  </div>
                </div>
              )}

              {/* Save Button */}
              <button
                className="ds-btn ds-btn-primary"
                onClick={handleSave}
                style={{ marginTop: '24px', width: '100%' }}
              >
                Salvar Simulação
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
