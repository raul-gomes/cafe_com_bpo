import React, { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { pricingFormSchema, PricingFormData } from '../../schemas/pricing';
import { useCalculatePricing, PricingResponse } from '../../api/hooks/usePricing';

const INITIAL_SERVICES = [
  { id:1, name:'Emissão de NF automática', type:'time' as const, minutes_per_execution:1.3, fixed_value:0, monthly_quantity:1, active:false, tip:'Sistema emite automaticamente' },
  { id:2, name:'Emissão de NF avulsa', type:'time' as const, minutes_per_execution:2.3, fixed_value:0, monthly_quantity:1, active:false, tip:'Preenchimento manual dos dados' },
  { id:3, name:'Emissão de boleto automático', type:'time' as const, minutes_per_execution:2, fixed_value:0, monthly_quantity:1, active:false, tip:'Sistema gera o boleto' },
  { id:4, name:'Emissão de boleto avulso', type:'time' as const, minutes_per_execution:3, fixed_value:0, monthly_quantity:1, active:false, tip:'Preenchimento manual' },
  { id:5, name:'Registros de recebimentos', type:'time' as const, minutes_per_execution:2.3, fixed_value:0, monthly_quantity:1, active:false, tip:'Lançamento de cada recebimento' },
  { id:6, name:'Registros de pagamentos', type:'time' as const, minutes_per_execution:2.3, fixed_value:0, monthly_quantity:1, active:false, tip:'Lançamento de cada pagamento' },
  { id:7, name:'Agendamento de pagamentos', type:'time' as const, minutes_per_execution:5, fixed_value:0, monthly_quantity:1, active:false, tip:'Verificar saldo, agendar no banco, confirmar.' },
  { id:8, name:'Gestão de conta bancária', type:'fixed' as const, minutes_per_execution:0, fixed_value:120, monthly_quantity:1, active:false, tip:'Gestão da conta (fixo mensal)' },
  { id:9, name:'Gestão da conta caixa', type:'fixed' as const, minutes_per_execution:0, fixed_value:4500, monthly_quantity:1, active:false, tip:'Controle total da liquidez da empresa cliente.' },
  { id:10, name:'Conciliação de fatura de cartão', type:'fixed' as const, minutes_per_execution:0, fixed_value:500, monthly_quantity:1, active:false, tip:'Revisão de transações e contestações.' },
];

export const PricingCalculatorLayout: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register, control, getValues, setValue, formState: { errors } } = useForm<PricingFormData>({
    resolver: zodResolver(pricingFormSchema) as any,
    defaultValues: {
      operation: {
        total_cost: 8000,
        people_count: 2,
        hours_per_month: 220,
        tax_rate: 0.06,
        commission_rate: 0,
      },
      services: INITIAL_SERVICES,
      desired_profit_margin: 0.50, // moderate
      term_discount: 0, // monthly
    }
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "services"
  });

  const [result, setResult] = useState<PricingResponse | null>(null);
  const [calculationError, setCalculationError] = useState<string | null>(null);

  const calculateMutation = useCalculatePricing();

  // Watch for ALL changes to auto-calculate
  const watchedData = useWatch({ control });

  // Compute local values for UI directly
  const { total_cost, people_count, hours_per_month } = getValues('operation') || {total_cost: 0, people_count: 1, hours_per_month: 1};
  const totalHours = (people_count || 1) * (hours_per_month || 1);
  const costPerHour = totalHours > 0 ? (total_cost || 0) / totalHours : 0;
  const costPerMin = costPerHour / 60;

  const triggerCalculate = useCallback((data: PricingFormData) => {
    // Only fetch if has active services to avoid dummy errors
    const activeServices = data.services.filter(s => s.active);
    if(activeServices.length > 0) {
      // Mandar pro backend apenas ativos para não sobrecarregar
      const payload: PricingFormData = {
        ...data,
        services: activeServices
      };
      
      calculateMutation.mutate(payload, {
        onSuccess: (res) => {
          setResult(res);
          setCalculationError(null);
        },
        onError: () => {
          setCalculationError("Falha na conexão com a API. Verifique os dados.");
        }
      });
    } else {
      setResult(null); // No active services = zero
    }
  }, [calculateMutation]);

  // Debounced auto-calculation when fields change
  useEffect(() => {
    const data = getValues();
    const handler = setTimeout(() => {
      triggerCalculate(data);
    }, 600); // 600ms debounce
    return () => clearTimeout(handler);
  }, [watchedData, getValues, triggerCalculate]);

  const toggleService = (index: number) => {
    const svc = getValues(`services.${index}`);
    update(index, { ...svc, active: !svc.active });
  };

  const fmt = (v: number | string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

  // Custom UI State
  const currentScenario = getValues('desired_profit_margin');
  const currentTerm = getValues('term_discount');

  // Adicionar novo serviço logic
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcType, setNewSvcType] = useState<"time"|"fixed">("time");
  const [newSvcNum, setNewSvcNum] = useState(10);

  const handleAddNew = () => {
    if (!newSvcName) return;
    append({
      id: Date.now(),
      name: newSvcName,
      type: newSvcType,
      minutes_per_execution: newSvcType === 'time' ? newSvcNum : 0,
      fixed_value: newSvcType === 'fixed' ? newSvcNum : 0,
      monthly_quantity: 1,
      active: true,
      tip: 'Serviço personalizado'
    });
    setNewSvcName("");
    setNewSvcNum(10);
  };

  // Calcular desconto de prazo para aplicar na base que a API devolve (se a API estiver desatualizada)
  const termMapping = { 0: 'por mês', 0.05: 'a cada 3 meses', 0.1: 'por ano' };
  
  const renderResultTotal = () => {
    if (!result) return fmt(0);
    const apiPrice = result.final_price;
    const discountVal = apiPrice * currentTerm;
    return fmt(apiPrice - discountVal);
  };

  const renderResultDiscountVal = () => {
    if (!result) return fmt(0);
    const apiPrice = result.final_price;
    return fmt(apiPrice * currentTerm);
  };

  return (
    <div className="app-body">
      <div className="left-col">

        {/* PASSO 1 */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">1</span>
            <h2>Configurações da sua operação</h2>
          </div>
          <div className="card-body">
            <div className="config-grid">
              <div className="field">
                <div className="field-label">Custo total mensal (R$)</div>
                <input type="number" {...register('operation.total_cost', {valueAsNumber: true})} min="0" step="100" />
                {errors.operation?.total_cost && <div className="error-text" style={{color:'red'}}>{errors.operation.total_cost.message}</div>}
              </div>
              <div className="field">
                <div className="field-label">Pessoas na operação</div>
                <input type="number" {...register('operation.people_count', {valueAsNumber: true})} min="1" />
              </div>
              <div className="field">
                <div className="field-label">Horas / mês (por pessoa)</div>
                <input type="number" {...register('operation.hours_per_month', {valueAsNumber: true})} min="1" />
              </div>
              <div className="field">
                <div className="field-label">Simples Nacional (Fat.)</div>
                <input type="number" {...register('operation.tax_rate', {valueAsNumber: true})} placeholder="ex: 0.06" step="0.01" />
              </div>
              <div className="field">
                <div className="field-label">Comissão de Vendas (Fat.)</div>
                <input type="number" {...register('operation.commission_rate', {valueAsNumber: true})} placeholder="ex: 0" step="0.01" />
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

        {/* PASSO 2 */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">2</span>
            <h2>Cenário de precificação</h2>
          </div>
          <div className="card-body">
            <div className="scenario-grid">
              <button type="button" className={`scenario-btn ${currentScenario === 0.30 ? 'active' : ''}`} onClick={() => setValue('desired_profit_margin', 0.30)}>
                <div className="sc-name">Conservador</div>
                <div className="sc-pct">30%</div>
                <div className="sc-why">Para conquistar clientes iniciais.</div>
              </button>
              <button type="button" className={`scenario-btn ${currentScenario === 0.50 ? 'active' : ''}`} onClick={() => setValue('desired_profit_margin', 0.50)}>
                <div className="sc-name">Moderado</div>
                <div className="sc-pct">50%</div>
                <div className="sc-why">Equilíbrio (recomendado).</div>
              </button>
              <button type="button" className={`scenario-btn ${currentScenario === 1.00 ? 'active' : ''}`} onClick={() => setValue('desired_profit_margin', 1.00)}>
                <div className="sc-name">Agressivo</div>
                <div className="sc-pct">100%</div>
                <div className="sc-why">Dobra a margem no markup.</div>
              </button>
            </div>
          </div>
        </div>

        {/* PASSO 3: Serviços */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">3</span>
            <h2>Serviços incluídos no contrato</h2>
          </div>
          <div className="card-body">
            <div style={{overflowX: 'auto'}}>
              <table className="svc-table">
                <thead>
                  <tr>
                    <th style={{width: '44px'}}>Ativo</th>
                    <th>Serviço</th>
                    <th style={{width: '76px', textAlign: 'center'}}>Qtd/mês</th>
                    <th style={{width: '108px', textAlign: 'center'}}>Valor (Custo)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((svc, index) => {
                    const isTime = svc.type === 'time';
                    const valueCalculated = isTime ? (getValues(`services.${index}.minutes_per_execution`) || 0) * (getValues(`services.${index}.monthly_quantity`) || 0) * costPerMin : (getValues(`services.${index}.fixed_value`) || 0) * (getValues(`services.${index}.monthly_quantity`) || 0);
                    const isActive = getValues(`services.${index}.active`);
                    
                    return (
                      <tr key={svc.id} className={isActive ? 'active-row' : ''}>
                        <td>
                          <label className="tog">
                            <input type="checkbox" checked={isActive} onChange={() => toggleService(index)} />
                            <span className="tog-sl"></span>
                          </label>
                        </td>
                        <td>
                          <div style={{fontWeight: 600, fontSize: '.84rem', color: '#111'}}>
                            {svc.name}
                            {svc.tip && <span className="tt tt-left" data-tip={svc.tip}>?</span>}
                          </div>
                          <div style={{marginTop: '2px'}}>
                            {isTime ? <span className="badge-time">Tempo</span> : <span className="badge-fixed">Fixo</span>}
                          </div>
                        </td>
                        <td style={{textAlign: 'center'}}>
                          <input type="number" className="qty-inp" {...register(`services.${index}.monthly_quantity`, {valueAsNumber: true})} disabled={!isActive} />
                        </td>
                        <td style={{textAlign: 'center'}}>
                          {isTime ? (
                            <span style={{fontSize: '.8rem', color: '#6b7280'}}>{isActive ? fmt(valueCalculated) : '—'}</span>
                          ) : (
                            <input type="number" className="val-inp" {...register(`services.${index}.fixed_value`, {valueAsNumber: true})} disabled={!isActive} />
                          )}
                        </td>
                        <td>
                          <button type="button" className="btn-rm" onClick={() => remove(index)}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ADICIONAR NOVO */}
            <div className="add-row">
              <div className="field">
                <div className="field-label">Nome do serviço</div>
                <input type="text" value={newSvcName} onChange={e => setNewSvcName(e.target.value)} placeholder="Ex: Conciliação diária" style={{padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:'8px', width:'100%'}}/>
              </div>
              <div className="field">
                <div className="field-label">Tipo</div>
                <select value={newSvcType} onChange={e => setNewSvcType(e.target.value as any)} style={{padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:'8px', width:'100%'}}>
                  <option value="time">Por tempo</option>
                  <option value="fixed">Fixo</option>
                </select>
              </div>
              <div className="field">
                <div className="field-label">{newSvcType === 'time' ? 'Tempo (min)' : 'Valor (R$)'}</div>
                <input type="number" value={newSvcNum} onChange={e => setNewSvcNum(Number(e.target.value))} style={{padding:'9px 12px', border:'1.5px solid #e5e7eb', borderRadius:'8px', width:'100%'}}/>
              </div>
              <div style={{display:'flex', alignItems:'flex-end'}}>
                <button type="button" onClick={handleAddNew} className="btn btn-black" style={{width:'100%', height: '42px', display:'flex', justifyContent:'center'}}>Adicionar</button>
              </div>
            </div>

          </div>
        </div>

        {/* PASSO 4 */}
        <div className="card">
          <div className="card-header">
            <span className="step-badge">4</span>
            <h2>Prazo de pagamento</h2>
          </div>
          <div className="card-body">
            <div className="term-grid">
              <button type="button" className={`term-btn ${currentTerm === 0 ? 'active' : ''}`} onClick={() => setValue('term_discount', 0)}>
                <div className="t-name">Mensal</div><div className="t-disc">0% desc.</div>
              </button>
              <button type="button" className={`term-btn ${currentTerm === 0.05 ? 'active' : ''}`} onClick={() => setValue('term_discount', 0.05)}>
                <div className="t-name">Trimestral</div><div className="t-disc">5% desc.</div>
              </button>
              <button type="button" className={`term-btn ${currentTerm === 0.10 ? 'active' : ''}`} onClick={() => setValue('term_discount', 0.10)}>
                <div className="t-name">Anual</div><div className="t-disc">10% desc.</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY */}
      <div>
        <div className="summary-card">
          <div className="sum-header">
            <h2>Resumo da Precificação</h2>
          </div>
          <div className="sum-body">
            {calculationError ? (
              <div style={{color: 'red', fontSize: '13px', marginBottom: '15px'}}>{calculationError}</div>
            ) : null}
            
            {calculateMutation.isPending && !result ? (
              <div style={{color: 'gray', fontSize: '14px', marginBottom: '15px', textAlign: 'center'}}>Processando reativamente na API...</div>
            ) : null}

            <div className="sum-row">
              <span className="lbl">Custo Operacional Total</span>
              <span className="val">{result ? fmt(result.breakdown.total_service_cost) : 'R$ 0,00'}</span>
            </div>
            <div className="sum-row">
              <span className="lbl">Margem Projetada ({currentScenario * 100}%)</span>
              <span className="val">{result ? fmt(result.breakdown.profit_amount) : 'R$ 0,00'}</span>
            </div>
            <div className="sum-row">
              <span className="lbl">Imposto (incl. Comissão API)</span>
              <span className="val">{result ? fmt(result.breakdown.tax_amount) : 'R$ 0,00'}</span>
            </div>
            
            <div className="sum-total-row">
              <span>Subtotal (Base)</span>
              <span>{result ? fmt(result.final_price) : 'R$ 0,00'}</span>
            </div>
            <div className="sum-row disc" style={{marginTop:'8px'}}>
              <span className="lbl">Desconto aplicado</span>
              <span className="val">− {renderResultDiscountVal()}</span>
            </div>

            <div className="sum-total-box">
              <div className="tl">Valor final sugerido</div>
              <div className="tv" style={{fontSize: '2.0rem', marginTop: '10px'}}>{renderResultTotal()}</div>
              {/* @ts-ignore */}
              <div className="tp-text" style={{fontSize: '12px', marginTop: '4px', opacity: 0.8}}>{termMapping[currentTerm] || 'por mês'}</div>
            </div>

            <button className="btn-pdf" onClick={() => window.alert("O gerador de PDF será feito em módulos futuros!")}>
              Gerar Proposta Comercial (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
