import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { pricingFormSchema, PricingFormData } from '../../schemas/pricing';
import { calculatePricing } from '../../lib/pricingEngine';

// ─── Catálogo de Serviços Inicial (Metodologia BPO v4) ─────────────────────────
const INITIAL_SERVICES = [
  { id:1,  name:'Emissão de NF automática',           type:'time'  as const, minutes_per_execution:1.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Sistema emite automaticamente, operador valida e confirma.' },
  { id:2,  name:'Emissão de NF avulsa',               type:'time'  as const, minutes_per_execution:2.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Preenchimento manual dos dados do cliente, verificação e emissão.' },
  { id:3,  name:'Emissão de boleto automático',        type:'time'  as const, minutes_per_execution:2,   fixed_value:0,    monthly_quantity:1, active:false, tip:'Sistema gera o boleto, operador valida dados e confirma envio.' },
  { id:4,  name:'Emissão de boleto avulso',            type:'time'  as const, minutes_per_execution:3,   fixed_value:0,    monthly_quantity:1, active:false, tip:'Preenchimento manual dos dados do beneficiário, valor e vencimento.' },
  { id:5,  name:'Registros de recebimentos',           type:'time'  as const, minutes_per_execution:2.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Lançamento de cada recebimento no sistema: identificar e conciliar.' },
  { id:6,  name:'Registros de pagamentos',             type:'time'  as const, minutes_per_execution:2.3, fixed_value:0,    monthly_quantity:1, active:false, tip:'Lançamento de cada pagamento: identificar, categorizar e confirmar.' },
  { id:7,  name:'Agendamento de pagamentos',           type:'time'  as const, minutes_per_execution:5,   fixed_value:0,    monthly_quantity:1, active:false, tip:'Verificar saldo, agendar no banco, confirmar e registrar.' },
  { id:8,  name:'Gestão de conta bancária',            type:'fixed' as const, minutes_per_execution:0,   fixed_value:120,  monthly_quantity:1, active:false, tip:'Gestão e monitoramento da conta bancária mensal por conta.' },
  { id:9,  name:'Gestão da conta caixa',               type:'fixed' as const, minutes_per_execution:0,   fixed_value:4500, monthly_quantity:1, active:false, tip:'Controle total da liquidez da empresa cliente (Alta Responsabilidade).' },
  { id:10, name:'Gestão de plataforma de recebimento', type:'fixed' as const, minutes_per_execution:0,   fixed_value:350,  monthly_quantity:1, active:false, tip:'Administração de maquininhas, gateways ou plataformas de cobrança.' },
  { id:11, name:'Conciliação de fatura de cartão',     type:'fixed' as const, minutes_per_execution:0,   fixed_value:500,  monthly_quantity:1, active:false, tip:'Revisão de transações, contestações e reconciliação financeira.' },
  { id:12, name:'Reunião mensal de uma hora',          type:'fixed' as const, minutes_per_execution:0,   fixed_value:250,  monthly_quantity:1, active:false, tip:'Reunião estratégica mensal. Consultoria de alto valor.' },
  { id:13, name:'Envio de relatórios mensais',         type:'fixed' as const, minutes_per_execution:0,   fixed_value:100,  monthly_quantity:1, active:false, tip:'Envio organizado de indicadores e relatórios financeiros.' },
  { id:14, name:'Enviar movimentação para contador',   type:'fixed' as const, minutes_per_execution:0,   fixed_value:100,  monthly_quantity:1, active:false, tip:'Organização e envio da movimentação para a contabilidade.' },
  { id:15, name:'Cobrança ativa',                      type:'fixed' as const, minutes_per_execution:0,   fixed_value:1500, monthly_quantity:1, active:false, tip:'Gestão de inadimplência: contatos e acordos de negociação.' },
  { id:16, name:'BTO (Business Transaction Ops.)',     type:'fixed' as const, minutes_per_execution:0,   fixed_value:500,  monthly_quantity:1, active:false, tip:'Operações transacionais amplas e suporte operacional.' },
];

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

export const PublicPricingSimulator: React.FC = () => {
  const navigate = useNavigate();
  const [clientName, setClientName] = useState('');
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcType, setNewSvcType] = useState<'time' | 'fixed'>('time');
  const [newSvcNum, setNewSvcNum]   = useState(10);

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
  const watchedValues = useWatch({ control }) as PricingFormData;

  const currentScenario = watchedValues?.desired_profit_margin ?? 0.5;
  const currentTerm     = watchedValues?.term_discount ?? 0;

  const toggleService = (index: number) => {
    const svc = getValues(`services.${index}`);
    update(index, { ...svc, active: !svc.active });
  };

  const handleVisualize = () => {
    const form = getValues();
    const result = calculatePricing(form.operation, form.services, form.desired_profit_margin, form.term_discount);
    
    const simulationState = { 
      form, 
      pricing: result,
      clientName: clientName || 'Empresa'
    };
    sessionStorage.setItem('cafe_bpo_proposal', JSON.stringify(simulationState));
    navigate('/proposta');
  };

  const op = watchedValues?.operation;
  const totalHours  = (op?.people_count || 0) * (op?.hours_per_month || 0);
  const costPerHour = totalHours > 0 ? (op?.total_cost || 0) / totalHours : 0;
  const costPerMin  = costPerHour / 60;

  return (
    <div className="calculator-wrapper public-simulator" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="app-body">
        <div className="left-col" style={{ width: '100%' }}>
          {/* Nome do Cliente */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-body" style={{ padding: '20px' }}>
              <div className="field">
                <div className="field-label">Nome da Empresa / Cliente</div>
                <input 
                  type="text" 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)} 
                  placeholder="Ex: Empresa XYZ Ltda." 
                  className="ds-input"
                  style={{ fontSize: '16px', fontWeight: 600 }}
                />
              </div>
            </div>
          </div>

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
                  <div className="field-label">Simples Nacional (%)</div>
                  <input type="number" {...register('operation.tax_rate', { valueAsNumber: true, setValueAs: v => (v === "" ? 0 : parseFloat(v) / 100) })} placeholder="ex: 6" step="0.1" />
                </div>
                <div className="field">
                  <div className="field-label">Comissão de Vendas (%)</div>
                  <input type="number" {...register('operation.commission_rate', { valueAsNumber: true, setValueAs: v => (v === "" ? 0 : parseFloat(v) / 100) })} placeholder="ex: 5" step="0.1" />
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
                  <button key={value} type="button" className={`scenario-btn ${currentScenario === value ? 'active' : ''}`} onClick={() => setValue('desired_profit_margin', value)} >
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
                <table className="svc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '44px' }}>Ativo</th>
                      <th>Serviço</th>
                      <th style={{ width: '76px', textAlign: 'center' }}>Qtd/mês</th>
                      <th style={{ width: '108px', textAlign: 'center' }}>Valor (Custo)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((svc, index) => {
                      const svcData   = watchedValues?.services?.[index];
                      const isActive  = svcData?.active ?? false;
                      const isFixed   = svc.type === 'fixed';
                      const qty       = svcData?.monthly_quantity || 0;
                      const valueCalc = !isFixed
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
                            </div>
                            <div style={{ marginTop: '2px' }}>
                              {!isFixed ? <span className="badge-time">Tempo</span> : <span className="badge-fixed">Fixo</span>}
                              {!isFixed && <span style={{ fontSize: '.7rem', color: 'var(--ds-text-disabled)', marginLeft: '8px' }}>{svc.minutes_per_execution} min/un</span>}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="number" className="qty-inp" {...register(`services.${index}.monthly_quantity`, { valueAsNumber: true })} disabled={!isActive} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {!isFixed ? (
                              <span style={{ fontSize: '.8rem', color: 'var(--ds-text-muted)' }}>{isActive ? fmt(valueCalc) : '—'}</span>
                            ) : (
                              <input type="number" className="val-inp" {...register(`services.${index}.fixed_value`, { valueAsNumber: true })} disabled={!isActive} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* PASSO 4 — Prazo */}
          <div className="card" style={{ marginBottom: '40px' }}>
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
                  <button key={value} type="button" className={`term-btn ${currentTerm === value ? 'active' : ''}`} onClick={() => setValue('term_discount', value)} >
                    <div className="t-name">{label}</div>
                    <div className="t-disc">{disc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CTA FINAL */}
          <div style={{ paddingBottom: '100px', textAlign: 'center', marginTop: '40px' }}>
            <button 
              className="ds-btn ds-btn-primary" 
              style={{ width: '100%', maxWidth: '600px', height: '60px', fontSize: '18px', fontWeight: 800 }}
              onClick={handleVisualize}
            >
              Visualizar Proposta Detalhada
            </button>
            <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--ds-text-muted)' }}>
              Acesse agora para visualizar os cálculos completos, impostos e gerar seu PDF.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
