import React, { useState, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pricingFormSchema, PricingFormData } from '../../schemas/pricing';
import { calculatePricing } from '../../lib/pricingEngine';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import logoAsset from '../../assets/logo.png';

// ─── Catálogo de Serviços Inicial ─────────────────────────────────────────────
const INITIAL_SERVICES = [
  { id:1,  name:'Emissão de NF automática',       type:'time'  as const, minutes_per_execution:1.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Sistema emite automaticamente' },
  { id:2,  name:'Emissão de NF avulsa',            type:'time'  as const, minutes_per_execution:2.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Preenchimento manual dos dados' },
  { id:3,  name:'Emissão de boleto automático',    type:'time'  as const, minutes_per_execution:2,   fixed_value:0,    monthly_quantity:1, active:false, tip:'Sistema gera o boleto' },
  { id:4,  name:'Emissão de boleto avulso',        type:'time'  as const, minutes_per_execution:3,   fixed_value:0,    monthly_quantity:1, active:false, tip:'Preenchimento manual' },
  { id:5,  name:'Registros de recebimentos',       type:'time'  as const, minutes_per_execution:2.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Lançamento de cada recebimento' },
  { id:6,  name:'Registros de pagamentos',         type:'time'  as const, minutes_per_execution:2.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Lançamento de cada pagamento' },
  { id:7,  name:'Agendamento de pagamentos',       type:'time'  as const, minutes_per_execution:5,   fixed_value:0,    monthly_quantity:1, active:false, tip:'Verificar saldo, agendar no banco, confirmar.' },
  { id:8,  name:'Gestão de conta bancária',        type:'fixed' as const, minutes_per_execution:0,   fixed_value:120,  monthly_quantity:1, active:false, tip:'Gestão da conta (fixo mensal)' },
  { id:9,  name:'Gestão da conta caixa',           type:'fixed' as const, minutes_per_execution:0,   fixed_value:4500, monthly_quantity:1, active:false, tip:'Controle total da liquidez da empresa cliente.' },
  { id:10, name:'Conciliação de fatura de cartão', type:'fixed' as const, minutes_per_execution:0,   fixed_value:500,  monthly_quantity:1, active:false, tip:'Revisão de transações e contestações.' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const termLabels: Record<number, string> = {
  0: 'por mês',
  0.05: 'a cada 3 meses',
  0.10: 'por ano',
};

// ─── Componente ───────────────────────────────────────────────────────────────
export const PricingCalculatorLayout: React.FC = () => {
  const { register, control, getValues, setValue, formState: { errors } } = useForm<PricingFormData>({
    resolver: zodResolver(pricingFormSchema) as any,
    defaultValues: {
      operation: {
        total_cost: 0,
        people_count: 0,
        hours_per_month: 0,
        tax_rate: 0,
        commission_rate: 0,
      },
      services: INITIAL_SERVICES,
      desired_profit_margin: 0.50,
      term_discount: 0,
    },
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: 'services' });

  // ── Observa TODOS os campos reativamente ──────────────────────────────────
  const watchedValues = useWatch({ control }) as PricingFormData;

  // ── Engine local: cálculo instantâneo sem chamada de rede ─────────────────
  // Ref: apps/backend/src/domain.py — PricingCalculator
  const pricing = useMemo(() => {
    const op = watchedValues?.operation;
    const svcs = watchedValues?.services ?? [];
    const margin = watchedValues?.desired_profit_margin ?? 0.5;
    const discount = watchedValues?.term_discount ?? 0;
    if (!op) return null;
    return calculatePricing(op, svcs, margin, discount);
  }, [watchedValues]);

  // ── Valores derivados reativos para a barra de cálculo ────────────────────
  const op = watchedValues?.operation;
  const totalHours  = (op?.people_count || 0) * (op?.hours_per_month || 0);
  const costPerHour = totalHours > 0 ? (op?.total_cost || 0) / totalHours : 0;
  const costPerMin  = costPerHour / 60;

  const currentScenario = watchedValues?.desired_profit_margin ?? 0.5;
  const currentTerm     = watchedValues?.term_discount ?? 0;

  // ── Ações ─────────────────────────────────────────────────────────────────
  const toggleService = (index: number) => {
    const svc = getValues(`services.${index}`);
    update(index, { ...svc, active: !svc.active });
  };

  // ── Hook de geração de PDF ───────────────────────────────────────────
  const { generate: generatePDF, isGenerating, error: pdfError } = useGeneratePDF();
  const [clientName, setClientName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcType, setNewSvcType] = useState<'time' | 'fixed'>('time');
  const [newSvcNum, setNewSvcNum]   = useState(10);

  const handleAddNew = () => {
    if (!newSvcName.trim()) return;
    append({
      id: Date.now(),
      name: newSvcName,
      type: newSvcType,
      minutes_per_execution: newSvcType === 'time' ? newSvcNum : 0,
      fixed_value: newSvcType === 'fixed' ? newSvcNum : 0,
      monthly_quantity: 1,
      active: true,
      tip: 'Serviço personalizado',
    });
    setNewSvcName('');
    setNewSvcNum(10);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-body">
      <div className="left-col">

        {/* PASSO 1 — Operação */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">1</span>
            <h2>Configurações da sua operação</h2>
          </div>
          <div className="card-body">
            <div className="config-grid">
              <div className="field">
                <div className="field-label">Custo total mensal (R$)</div>
                <input type="number" {...register('operation.total_cost', { valueAsNumber: true })} min="0" step="100" />
                {errors.operation?.total_cost && <div className="error-text">{errors.operation.total_cost.message}</div>}
              </div>
              <div className="field">
                <div className="field-label">Pessoas na operação</div>
                <input type="number" {...register('operation.people_count', { valueAsNumber: true })} min="1" />
              </div>
              <div className="field">
                <div className="field-label">Horas / mês (por pessoa)</div>
                <input type="number" {...register('operation.hours_per_month', { valueAsNumber: true })} min="1" />
              </div>
              <div className="field">
                <div className="field-label">Simples Nacional (Fat.)</div>
                <input type="number" {...register('operation.tax_rate', { valueAsNumber: true })} placeholder="ex: 0.06" step="0.01" />
              </div>
              <div className="field">
                <div className="field-label">Comissão de Vendas (Fat.)</div>
                <input type="number" {...register('operation.commission_rate', { valueAsNumber: true })} placeholder="ex: 0" step="0.01" />
              </div>
              <div className="field">
                <div className="field-label">Custo/hora — calculado</div>
                <input type="text" value={fmt(costPerHour)} readOnly disabled />
              </div>
            </div>

            <div className="computed-bar">
              <div className="computed-item"><span>Custo por minuto</span><strong>{fmt(costPerMin)}</strong></div>
              <div className="computed-item"><span>Total horas/mês (equipe)</span><strong>{totalHours.toFixed(0)}h</strong></div>
              <div className="computed-item"><span>Custo por hora</span><strong>{fmt(costPerHour)}</strong></div>
            </div>
          </div>
        </div>

        {/* PASSO 2 — Cenário */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">2</span>
            <h2>Cenário de precificação</h2>
          </div>
          <div className="card-body">
            <div className="scenario-grid">
              {([
                { value: 0.30, label: 'Conservador', pct: '30%', why: 'Para conquistar clientes iniciais.' },
                { value: 0.50, label: 'Moderado',    pct: '50%', why: 'Equilíbrio (recomendado).' },
                { value: 1.00, label: 'Agressivo',   pct: '100%', why: 'Dobra a margem no markup.' },
              ] as const).map(({ value, label, pct, why }) => (
                <button
                  key={value}
                  type="button"
                  className={`scenario-btn ${currentScenario === value ? 'active' : ''}`}
                  onClick={() => setValue('desired_profit_margin', value)}
                >
                  <div className="sc-name">{label}</div>
                  <div className="sc-pct">{pct}</div>
                  <div className="sc-why">{why}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PASSO 3 — Serviços */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">3</span>
            <h2>Serviços incluídos no contrato</h2>
          </div>
          <div className="card-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="svc-table">
                <thead>
                  <tr>
                    <th style={{ width: '44px' }}>Ativo</th>
                    <th>Serviço</th>
                    <th style={{ width: '76px', textAlign: 'center' }}>Qtd/mês</th>
                    <th style={{ width: '108px', textAlign: 'center' }}>Valor (Custo)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((svc, index) => {
                    const svcData   = watchedValues?.services?.[index];
                    const isActive  = svcData?.active ?? false;
                    const isTime    = svc.type === 'time';
                    const qty       = svcData?.monthly_quantity || 0;
                    const valueCalc = isTime
                      ? (svcData?.minutes_per_execution || 0) * qty * costPerMin
                      : (svcData?.fixed_value || 0) * qty;

                    return (
                      <tr key={svc.id} className={isActive ? 'active-row' : ''}>
                        <td>
                          <label className="tog">
                            <input type="checkbox" checked={isActive} onChange={() => toggleService(index)} />
                            <span className="tog-sl"></span>
                          </label>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '.84rem', color: 'var(--ds-text)' }}>
                            {svc.name}
                            {svc.tip && <span className="tt tt-left" data-tip={svc.tip}>?</span>}
                          </div>
                          <div style={{ marginTop: '2px' }}>
                            {isTime
                              ? <span className="badge-time">Tempo</span>
                              : <span className="badge-fixed">Fixo</span>
                            }
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            className="qty-inp"
                            {...register(`services.${index}.monthly_quantity`, { valueAsNumber: true })}
                            disabled={!isActive}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isTime ? (
                            <span style={{ fontSize: '.8rem', color: 'var(--ds-text-muted)' }}>
                              {isActive ? fmt(valueCalc) : '—'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              className="val-inp"
                              {...register(`services.${index}.fixed_value`, { valueAsNumber: true })}
                              disabled={!isActive}
                            />
                          )}
                        </td>
                        <td>
                          <button type="button" className="btn-rm" onClick={() => remove(index)}>✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Adicionar serviço personalizado */}
            <div className="add-row">
              <div className="field">
                <div className="field-label">Nome do serviço</div>
                <input
                  type="text"
                  value={newSvcName}
                  onChange={e => setNewSvcName(e.target.value)}
                  placeholder="Ex: Conciliação diária"
                />
              </div>
              <div className="field">
                <div className="field-label">Tipo</div>
                <select value={newSvcType} onChange={e => setNewSvcType(e.target.value as 'time' | 'fixed')}>
                  <option value="time">Por tempo</option>
                  <option value="fixed">Fixo</option>
                </select>
              </div>
              <div className="field">
                <div className="field-label">{newSvcType === 'time' ? 'Tempo (min)' : 'Valor (R$)'}</div>
                <input
                  type="number"
                  value={newSvcNum}
                  onChange={e => setNewSvcNum(Number(e.target.value))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="btn btn-black"
                  style={{ width: '100%', height: '42px', display: 'flex', justifyContent: 'center' }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PASSO 4 — Prazo */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">4</span>
            <h2>Prazo de pagamento</h2>
          </div>
          <div className="card-body">
            <div className="term-grid">
              {([
                { value: 0,    label: 'Mensal',     disc: '0% desc.' },
                { value: 0.05, label: 'Trimestral', disc: '5% desc.' },
                { value: 0.10, label: 'Anual',      disc: '10% desc.' },
              ] as const).map(({ value, label, disc }) => (
                <button
                  key={value}
                  type="button"
                  className={`term-btn ${currentTerm === value ? 'active' : ''}`}
                  onClick={() => setValue('term_discount', value)}
                >
                  <div className="t-name">{label}</div>
                  <div className="t-disc">{disc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SUMMARY CARD ───────────────────────────────────────────────────── */}
      <div>
        <div className="summary-card">
          <div className="sum-header">
            <h2>Resumo da Precificação</h2>
          </div>
          <div className="sum-body">

            <div className="sum-row">
              <span className="lbl">Custo Operacional Total</span>
              <span className="val">{fmt(pricing?.breakdown.total_service_cost ?? 0)}</span>
            </div>
            <div className="sum-row">
              <span className="lbl">Margem Projetada ({(currentScenario * 100).toFixed(0)}%)</span>
              <span className="val">{fmt(pricing?.breakdown.profit_amount ?? 0)}</span>
            </div>
            <div className="sum-row">
              <span className="lbl">Imposto + Comissão</span>
              <span className="val">{fmt(pricing?.breakdown.tax_amount ?? 0)}</span>
            </div>

            <div className="sum-total-row">
              <span>Subtotal (Base)</span>
              <span>{fmt(pricing?.price_before_discount ?? 0)}</span>
            </div>

            <div className="sum-row disc" style={{ marginTop: '8px' }}>
              <span className="lbl">Desconto aplicado</span>
              <span className="val">− {fmt(pricing?.discount_amount ?? 0)}</span>
            </div>

            <div className="sum-total-box">
              <div className="tl">Valor final sugerido</div>
              <div className="tv" style={{ fontSize: '2.0rem', marginTop: '10px' }}>
                {fmt(pricing?.final_price ?? 0)}
              </div>
              <div className="tp-text" style={{ fontSize: '12px', marginTop: '4px', opacity: 0.8 }}>
                {termLabels[currentTerm] ?? 'por mês'}
              </div>
            </div>

            {pdfError && (
              <div style={{ color: 'var(--ds-error)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>
                {pdfError}
              </div>
            )}

            {/* Campo nome do cliente */}
            <div style={{ marginTop: '12px' }}>
              <label style={{ fontSize: '10px', color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                Nome do cliente (para o PDF)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Ex: Empresa XYZ Ltda."
                style={{
                  width: '100%', padding: '8px 10px',
                  background: 'var(--ds-surface-2)',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--ds-text)',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                }}
              />
            </div>

            <button
              className="btn-pdf"
              disabled={isGenerating || !pricing}
              onClick={() => {
                if (!pricing) return;
                generatePDF({
                  form: getValues(),
                  pricing,
                  logoUrl: logoAsset,
                  clientName: clientName || 'Cliente',
                });
              }}
            >
              {isGenerating ? 'Gerando PDF...' : 'Gerar Proposta Comercial (PDF)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
