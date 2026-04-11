import React from 'react';
import logoAsset from '../../assets/logo.png';
import { PricingFormData } from '../../schemas/pricing';
import { PricingResult } from '../../lib/pricingEngine';
import { ProposalDownloadGate } from './ProposalDownloadGate';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

const termLabels: Record<number, string> = {
  0:    'por mês',
  0.05: 'a cada 3 meses',
  0.10: 'por ano',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface ProposalPreviewProps {
  form: PricingFormData;
  pricing: PricingResult;
  clientName: string;
  generatedAt: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export const ProposalPreview: React.FC<ProposalPreviewProps> = ({
  form,
  pricing,
  clientName,
  generatedAt,
}) => {
  const activeServices = form.services.filter(s => s.active);
  const termLabel = termLabels[form.term_discount] ?? 'por mês';
  const op = form.operation;

  return (
    <div className="proposal-inner">

      {/* ═══════ SEÇÃO 1 — CAPA ═══════════════════════════════ */}
      <section className="prop-section prop-cover" data-delay="1">
        <div className="prop-cover-accent" />

        <div>
          <img src={logoAsset} alt="Café com BPO" className="prop-cover-logo" />
          <div className="prop-cover-tag">Proposta Comercial</div>
          <h1 className="prop-cover-title">Precificação BPO{'\n'}Personalizada</h1>
          <p className="prop-cover-sub">
            Simulação detalhada do custo de operação gerada dinamicamente
            com base na realidade do negócio de <strong>{clientName}</strong>.
          </p>
        </div>

        <div className="prop-cover-meta">
          <div className="prop-cover-meta-item">
            <span className="prop-meta-label">Cliente</span>
            <span className="prop-meta-value">{clientName}</span>
          </div>
          <div className="prop-cover-meta-item">
            <span className="prop-meta-label">Data</span>
            <span className="prop-meta-value">{generatedAt}</span>
          </div>
          <div className="prop-cover-meta-item">
            <span className="prop-meta-label">Serviços ativos</span>
            <span className="prop-meta-value">{activeServices.length}</span>
          </div>
          <div className="prop-cover-meta-item">
            <span className="prop-meta-label">Valor sugerido</span>
            <span className="prop-meta-value prop-meta-value--accent">{fmt(pricing.final_price)}</span>
          </div>
        </div>

        {/* Watermark */}
        <span className="prop-cover-bpo">BPO</span>
      </section>

      {/* ═══════ SEÇÃO 2 — OPERAÇÃO ═══════════════════════════ */}
      <section className="prop-section" data-delay="2">
        <h2 className="prop-section-title">Contexto Operacional</h2>

        <div className="prop-op-grid">
          {[
            { label: 'Custo Total Mensal',   value: fmt(op.total_cost) },
            { label: 'Pessoas na Operação',  value: `${op.people_count} pessoa(s)` },
            { label: 'Horas / Mês',          value: `${op.hours_per_month}h` },
            { label: 'Simples Nacional',     value: pct(op.tax_rate) },
            { label: 'Comissão de Vendas',   value: pct(op.commission_rate || 0) },
            { label: 'Custo por Hora',       value: fmt(pricing.breakdown.cost_per_hour), accent: true },
            { label: 'Custo por Minuto',     value: fmt(pricing.breakdown.cost_per_minute), accent: true },
            { label: 'Margem de Lucro',      value: pct(form.desired_profit_margin), accent: true },
            { label: 'Prazo de Pagamento',   value: termLabel },
          ].map(item => (
            <div key={item.label} className="prop-op-item">
              <span className="prop-op-label">{item.label}</span>
              <span className={`prop-op-value${item.accent ? ' prop-op-value--accent' : ''}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ SEÇÃO 3 — SERVIÇOS ════════════════════════════ */}
      <section className="prop-section" data-delay="3">
        <h2 className="prop-section-title">Serviços Contratados ({activeServices.length})</h2>

        <table className="prop-svc-table">
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'center' }}>Qtd/mês</th>
              <th>Custo Estimado</th>
            </tr>
          </thead>
          <tbody>
            {pricing.breakdown.service_costs.map((item, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: item.type === 'time' ? 'rgba(251,191,36,0.1)' : 'rgba(74,222,128,0.1)',
                    color: item.type === 'time' ? 'var(--ds-primary)' : '#4ade80',
                  }}>
                    {item.type === 'time' ? 'Tempo' : 'Fixo'}
                  </span>
                </td>
                <td style={{ textAlign: 'center', color: 'var(--ds-text-muted)' }}>{item.monthly_quantity}x</td>
                <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(item.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ═══════ SEÇÃO 4 — FINANCEIRO ══════════════════════════ */}
      <section className="prop-section" data-delay="4">
        <h2 className="prop-section-title">Composição do Valor</h2>

        <div className="prop-breakdown">
          <div className="prop-breakdown-row">
            <span className="prop-breakdown-label">Custo Operacional Total</span>
            <span className="prop-breakdown-value">{fmt(pricing.breakdown.total_service_cost)}</span>
          </div>
          <div className="prop-breakdown-row">
            <span className="prop-breakdown-label">Margem de Lucro ({pct(form.desired_profit_margin)})</span>
            <span className="prop-breakdown-value">{fmt(pricing.breakdown.profit_amount)}</span>
          </div>
          <div className="prop-breakdown-row">
            <span className="prop-breakdown-label">Impostos + Comissão</span>
            <span className="prop-breakdown-value">{fmt(pricing.breakdown.tax_amount)}</span>
          </div>
          <div className="prop-breakdown-subtotal">
            <span>Subtotal</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(pricing.price_before_discount)}</span>
          </div>
          {pricing.discount_amount > 0 && (
            <div className="prop-breakdown-row">
              <span className="prop-breakdown-label">Desconto de Prazo ({pct(form.term_discount)})</span>
              <span className="prop-breakdown-discount">− {fmt(pricing.discount_amount)}</span>
            </div>
          )}
        </div>

        {/* Valor final */}
        <div className="prop-final-box">
          <div className="prop-final-label">Valor Final Sugerido</div>
          <div className="prop-final-value">{fmt(pricing.final_price)}</div>
          <div className="prop-final-period">{termLabel}</div>
        </div>
      </section>

      {/* ═══════ GATE DE DOWNLOAD ══════════════════════════════ */}
      <ProposalDownloadGate
        form={form}
        pricing={pricing}
        clientName={clientName}
      />
    </div>
  );
};
