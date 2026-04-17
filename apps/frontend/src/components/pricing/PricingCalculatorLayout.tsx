import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { pricingFormSchema, PricingFormData } from '../../schemas/pricing';
import { calculatePricing } from '../../lib/pricingEngine';
import { saveProposalSession } from '../../schemas/proposalSession';
import { useGeneratePDF } from '../../lib/useGeneratePDF';
import logoAsset from '../../assets/logo.png';
import { getClients, createClient, ClientData } from '../../api/clients';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../api/client';

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

interface PricingCalculatorLayoutProps {
  initialData?: PricingFormData;
  initialClientName?: string;
  isSaving?: boolean;
  onSave?: (data: PricingFormData, clientName: string) => void;
  saveButtonLabel?: string;
}

export const PricingCalculatorLayout: React.FC<PricingCalculatorLayoutProps> = ({
  initialData,
  initialClientName = '',
  isSaving = false,
  onSave,
  saveButtonLabel = 'Salvar Proposta'
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { generate: generatePDF, isGenerating } = useGeneratePDF();
  const [clientName, setClientName] = useState(initialClientName);

  const [clients, setClients] = useState<ClientData[]>([]);
  const [showClientMenu, setShowClientMenu] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', cnpj: '', phone: '', email: '' });

  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcType, setNewSvcType] = useState<'time' | 'fixed'>('time');
  const [newSvcNum, setNewSvcNum]   = useState(10);
  const [localHourlyCost, setLocalHourlyCost] = useState('');

  // Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const tutorialSteps = [
    {
      id: 1,
      tag: 'Passo 1 — Configurações da operação',
      title: 'Custo total mensal: o que entra nesse número?',
      text: 'Este é o campo mais importante da calculadora. Ele representa quanto custa sua empresa existir por mês, independente de faturar ou não.',
      items: [
        'Pró-labore (seu salário como sócio)',
        'Salários de colaboradores e encargos',
        'Aluguel, sistemas e ferramentas',
        'Contador, internet e marketing'
      ],
      example: 'Operação com 1 pessoa: pró-labore R$ 4.000 + sistemas R$ 500 + contador R$ 400 + internet/telefone R$ 200 + marketing R$ 300 = R$ 5.400/mês',
      insight: 'O padrão desta calculadora (R$ 8.000) é uma referência para operação com 2 pessoas. Ajuste para a sua realidade.'
    },
    {
      id: 2,
      tag: 'Passo 2 — Pessoas e horas',
      title: 'Pessoas na operação e horas trabalhadas',
      text: 'Com esses dois campos a calculadora descobre quanto custa cada hora do seu trabalho (Custo/Hora).',
      items: [
        'Pessoas: apenas quem executa serviços para clientes.',
        'Horas/mês: apenas horas produtivas dedicadas a clientes.'
      ],
      example: '22 dias úteis × 6h dedicadas = 132h/mês. Se dedicar 8h/dia = 176h/mês.',
      insight: 'Se o seu custo é fixo e você trabalha menos horas, seu custo por hora sobe — e o preço dos serviços precisa acompanhar.'
    },
    {
      id: 3,
      tag: 'Passo 3 — Impostos e comissão',
      title: 'Simples Nacional e comissão de vendas',
      text: 'Impostos e comissões são calculados "de fora para dentro" para garantir que sua margem não seja corroída.',
      items: [
        'Simples Nacional: Alíquota sobre o faturamento.',
        'Comissão: Percentual pago para parcerias/indicação.'
      ],
      example: 'Se cobra R$ 1.000 e paga 6% de Simples = R$ 60 para o governo. A calculadora já embuti isso no preço final.',
      insight: 'Não sabe sua alíquota? Use 6% como estimativa conservadora.'
    },
    {
      id: 4,
      tag: 'Passo 4 — Serviços por Tempo',
      title: 'Serviços por tempo: o que são?',
      text: 'Serviços precificados com base em minutos de execução × custo do seu minuto de trabalho.',
      items: [
        'Emissão de NF automática (1,3 min)',
        'Emissão de NF avulsa (2,3 min)',
        'Agendamento de pagamentos (5 min)'
      ],
      insight: 'Os tempos padrão são referências. Quanto mais preciso o seu tempo, mais precisa a sua precificação.'
    },
    {
      id: 5,
      tag: 'Passo 5 — Serviços Fixos',
      title: 'Serviços de valor fixo: responsabilidade',
      text: 'Alguns serviços têm um valor de mercado ou de responsabilidade que vai além do tempo gasto.',
      items: [
        'Gestão de conta caixa (R$ 4.500): Risco e responsabilidade.',
        'Cobrança ativa (R$ 1.500): Valor de resultado.',
        'Reunião mensal (R$ 250): Valor da hora estratégica.'
      ],
      insight: 'Os valores padrão são referências de mercado. Ajuste conforme o perfil do cliente e a complexidade.'
    },
    {
      id: 6,
      tag: 'Passo 6 — Cenários',
      title: 'Conservador, Moderado ou Agressivo?',
      text: 'O cenário define sua margem de lucro sobre o custo operacional.',
      items: [
        'Conservador (30%): Clientes iniciais ou entrada em mercado.',
        'Moderado (50%): Equilíbrio ideal (recomendado).',
        'Agressivo (100%): Histórico comprovado e alto valor.'
      ],
      insight: 'Evite o Conservador como padrão. Ele pode criar uma ancoragem muito baixa para reajustes futuros.'
    },
    {
      id: 7,
      tag: 'Passo 7 — Prazo',
      title: 'Prazo como ferramenta comercial',
      text: 'O desconto por prazo incentiva contratos mais longos e previsibilidade de caixa.',
      items: [
        'Mensal: Sem desconto. Flexibilidade total.',
        'Trimestral: 5% de desconto. 3 meses garantidos.',
        'Anual: 10% de desconto. 12 meses de fluxo certo.'
      ],
      insight: 'Sempre apresente as 3 opções. O cliente tende a escolher o anual pelo custo-benefício, e você ganha retenção.'
    },
    {
      id: 8,
      tag: 'Passo 8 — Proposta PDF',
      title: 'Como usar o PDF gerado',
      text: 'A proposta profissional detalha os serviços e a metodologia de valor.',
      items: [
        'Preencha dados da sua empresa para o rodapé.',
        'Use link da Logo para profissionalismo.',
        'Defina validade (7 a 15 dias) para gerar urgência.'
      ],
      insight: 'Envie por PDF, não só o link. Isso garante que o cliente veja a apresentação exatamente como você planejou.'
    }
  ];

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, tutorialSteps.length));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const openTutorialStep = (step: number) => {
    setCurrentStep(step);
    setShowTutorial(true);
  };

  const { register, control, getValues, setValue, reset, formState: { errors } } = useForm<PricingFormData>({
    resolver: zodResolver(pricingFormSchema) as any,
    defaultValues: initialData || {
      operation: {
        total_cost: 0,
        people_count: 1,
        hours_per_month: 160,
        tax_rate: 6,
        commission_rate: 0,
      },
      services: INITIAL_SERVICES,
      desired_profit_margin: 0.50,
      term_discount: 0,
    },
  });

  const { fields, append, remove, update } = useFieldArray({ control, name: 'services' });

  useEffect(() => {
    if (initialData) {
      reset(initialData);
      setClientName(initialClientName);
    }
    
    // Load clients
    getClients().then(setClients).catch(console.error);
  }, [initialData, initialClientName, reset]);

  const watchedValues = useWatch({ control }) as PricingFormData;

  const pricing = useMemo(() => {
    const op = watchedValues?.operation;
    const svcs = watchedValues?.services ?? [];
    const margin = watchedValues?.desired_profit_margin ?? 0.5;
    const discount = watchedValues?.term_discount ?? 0;
    if (!op) return null;
    return calculatePricing(op, svcs, margin, discount);
  }, [watchedValues]);

  const op = watchedValues?.operation;
  const totalHours  = (op?.people_count || 0) * (op?.hours_per_month || 0);
  const costPerHour = totalHours > 0 ? (op?.total_cost || 0) / totalHours : 0;
  const costPerMin  = costPerHour / 60;

  useEffect(() => {
    if (!localHourlyCost) {
       if (costPerHour > 0) setLocalHourlyCost(costPerHour.toFixed(2));
    } else {
       const parsedLocal = parseFloat(localHourlyCost.replace(',', '.'));
       if (isNaN(parsedLocal) || Math.abs(parsedLocal - costPerHour) > 0.1) {
          setLocalHourlyCost(costPerHour > 0 ? costPerHour.toFixed(2) : '');
       }
    }
  }, [costPerHour, localHourlyCost]);

  const handleHourlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const valStr = e.target.value.replace(',', '.');
     setLocalHourlyCost(valStr);
     const val = parseFloat(valStr);
     if (!isNaN(val) && totalHours > 0) {
        setValue('operation.total_cost', parseFloat((val * totalHours).toFixed(2)), { 
            shouldDirty: true, 
            shouldTouch: true, 
            shouldValidate: true 
        });
     } else if (valStr === '' || isNaN(val)) {
        setValue('operation.total_cost', 0, { shouldValidate: true });
     }
  };

  const currentScenario = watchedValues?.desired_profit_margin ?? 0.5;
  const currentTerm     = watchedValues?.term_discount ?? 0;

  const toggleService = (index: number) => {
    const svc = getValues(`services.${index}`);
    update(index, { ...svc, active: !svc.active });
  };

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

  const activeServicesCount = watchedValues?.services?.filter(s => s.active).length || 0;
  const hasActiveService = activeServicesCount > 0;

  // Validação do Cliente
  const isClientValid = clients.some(c => c.name.trim().toLowerCase() === clientName.trim().toLowerCase());
  const showClientError = clientName.trim().length > 0 && !isClientValid && !showNewClientForm;

  const handlePrimaryAction = () => {
    if (!pricing || !hasActiveService || !isClientValid) return;
    if (onSave) {
      onSave(getValues(), clientName);
    } else {
      saveProposalSession({
        form: getValues(),
        pricing,
        clientName: clientName,
      });
      navigate('/proposta');
    }
  };

  const handleDownload = async () => {
    if (!pricing || !hasActiveService || !isClientValid) return;
    const finalLogoUrl = user?.avatar_url ? `${getApiUrl()}${user.avatar_url}` : logoAsset;
    await generatePDF({
      form: getValues(),
      pricing,
      logoUrl: finalLogoUrl,
      clientName: clientName
    });
  };

  const handleAddNewClient = async () => {
    if (!newClient.name) return;
    try {
      const created = await createClient(newClient);
      setClients([...clients, created]);
      setClientName(created.name);
      setShowNewClientForm(false);
      setNewClient({ name: '', cnpj: '', phone: '', email: '' });
      setShowClientMenu(false);
    } catch (e) {
      console.error(e);
      alert('Erro ao criar cliente');
    }
  };

  return (
    <div className="calculator-wrapper">
      <div className="app-body">
        <div className="left-col">
          {/* Cabeçalho da Página com Acesso ao Guia */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px' }}>
            <button 
              onClick={() => openTutorialStep(1)} 
              className="ds-btn ds-btn-primary ds-btn-sm" 
              style={{ fontWeight: 700 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              Guia
            </button>
          </div>
          {/* Nome do Cliente */}
          <div className="card" style={{ marginBottom: '24px', overflow: 'visible' }}>
            <div className="card-body" style={{ padding: '20px' }}>
              <div className="field" style={{ position: 'relative' }}>
                <div className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nome da Empresa / Cliente</span>
                  <button type="button" onClick={() => setShowNewClientForm(!showNewClientForm)} className="ds-btn ds-btn-primary" style={{ padding: '0 12px', height: '28px', fontSize: '12px', fontWeight: 600 }}>
                    + Nova Empresa
                  </button>
                </div>

                {!showNewClientForm ? (
                  <>
                    <input 
                      type="text" 
                      value={clientName} 
                      onChange={e => {
                        setClientName(e.target.value);
                        setShowClientMenu(true);
                      }} 
                      onFocus={() => setShowClientMenu(true)}
                      onBlur={() => setTimeout(() => setShowClientMenu(false), 200)}
                      placeholder="Busque ou digite o nome do cliente..." 
                      className={`ds-input ${showClientError ? 'error' : ''}`}
                      style={{ 
                        fontSize: '16px', 
                        fontWeight: 600,
                        borderColor: showClientError ? '#ef4444' : undefined
                      }}
                    />
                    {showClientError && (
                      <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        Empresa não encontrada. Selecione da lista ou cadastre uma nova.
                      </div>
                    )}
                    {showClientMenu && clients.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--ds-surface)', border: '1px solid var(--ds-border)', borderRadius: '4px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        {clients.filter(c => c.name.toLowerCase().includes(clientName.toLowerCase())).map(c => (
                          <div 
                            key={c.id} 
                            style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--ds-border)', transition: 'background 0.2s' }}
                            onMouseDown={() => {
                              setClientName(c.name);
                              setShowClientMenu(false);
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ds-surface-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ fontWeight: 600, color: 'var(--ds-white)', fontSize: '14px' }}>{c.name}</div>
                            {(c.cnpj || c.email) && <div style={{ fontSize: '11px', color: 'var(--ds-text-subtle)' }}>{c.cnpj} {c.email}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ background: 'var(--ds-surface-hover)', padding: '16px', borderRadius: '6px', border: '1px solid var(--ds-border)', marginTop: '8px' }}>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label className="ds-label" style={{ fontSize: '11px' }}>Nome</label>
                          <input type="text" className="ds-input" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} />
                        </div>
                        <div>
                          <label className="ds-label" style={{ fontSize: '11px' }}>CNPJ</label>
                          <input type="text" className="ds-input" value={newClient.cnpj} onChange={e => setNewClient({...newClient, cnpj: e.target.value})} />
                        </div>
                        <div>
                          <label className="ds-label" style={{ fontSize: '11px' }}>Telefone</label>
                          <input type="text" className="ds-input" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="ds-label" style={{ fontSize: '11px' }}>E-mail</label>
                          <input type="email" className="ds-input" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} />
                        </div>
                     </div>
                     <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
                        <button type="button" className="ds-btn ds-btn-ghost" onClick={() => setShowNewClientForm(false)}>Cancelar</button>
                        <button type="button" className="ds-btn ds-btn-primary" onClick={handleAddNewClient} disabled={!newClient.name}>Salvar e Selecionar</button>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PASSO 1 — Operação */}
          <div className="card" style={{ overflow: 'visible' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="step-badge">1</span>
                <h2>Configurações da sua operação</h2>
              </div>
              <button onClick={() => openTutorialStep(1)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: '11px', opacity: 0.7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Explicar
              </button>
            </div>
            <div className="card-body">
              <div className="config-grid">
                <div className="field">
                  <div className="field-label">
                    Custo total mensal (R$)
                    <span className="tt" data-tip="Tudo que a empresa paga por mês para existir: pró-labore, salários, sistemas, contador, aluguel, internet, marketing.">?</span>
                  </div>
                  <input type="number" {...register('operation.total_cost', { valueAsNumber: true })} min="0" step="100" />
                  <div className="ds-hint">Exemplo: pró-labore R$ 2.500 + sistemas + contador + internet. Ajuste para sua realidade.</div>
                  {errors.operation?.total_cost && <div className="error-text">{errors.operation.total_cost.message}</div>}
                </div>
                <div className="field">
                  <div className="field-label">
                    Pessoas na operação
                    <span className="tt" data-tip="Apenas quem executa serviços para clientes diretamente. Um sócio que só cuida do administrativo não entra.">?</span>
                  </div>
                  <input type="number" {...register('operation.people_count', { valueAsNumber: true })} min="1" />
                  <div className="ds-hint">Apenas executores de serviços.</div>
                </div>
                <div className="field">
                  <div className="field-label">
                    Horas / mês (por pessoa)
                    <span className="tt" data-tip="Horas reais dedicadas a clientes, não total de horas trabalhadas. Descontar reuniões internas, prospecção, estudos.">?</span>
                  </div>
                  <input type="number" {...register('operation.hours_per_month', { valueAsNumber: true })} min="1" />
                  <div className="ds-hint">220h = jornada integral. 132h = 6h/dia útil.</div>
                </div>
                <div className="field">
                  <div className="field-label">
                    Simples Nacional (%)
                    <span className="tt" data-tip="Alíquota do faturamento. Consulte seu contador ou a última guia DAS.">?</span>
                  </div>
                  <input type="number" {...register('operation.tax_rate', { valueAsNumber: true })} placeholder="ex: 6" step="0.1" />
                  <div className="ds-hint">Consulte sua última guia DAS ou seu contador.</div>
                  {errors.operation?.tax_rate && <div className="error-text" style={{fontSize: '11px', color: '#dc2626', marginTop: '4px'}}>{errors.operation.tax_rate.message}</div>}
                </div>
                <div className="field">
                  <div className="field-label">
                    Comissão de Vendas (%)
                    <span className="tt" data-tip="Se você paga percentual para quem indica clientes. Deixe 0 se não houver.">?</span>
                  </div>
                  <input type="number" {...register('operation.commission_rate', { valueAsNumber: true })} placeholder="ex: 5" step="0.1" />
                  <div className="ds-hint">Zero se não há parceria de indicação.</div>
                  {errors.operation?.commission_rate && <div className="error-text" style={{fontSize: '11px', color: '#dc2626', marginTop: '4px'}}>{errors.operation.commission_rate.message}</div>}
                </div>
                <div className="field">
                  <div className="field-label">
                    Custo/hora (R$)
                    <span className="tt" data-tip="Calculado automaticamente: custo total ÷ horas úteis totais. Determina o preço base por minuto de serviço.">?</span>
                  </div>
                  <input 
                    type="text" 
                    value={localHourlyCost} 
                    onChange={handleHourlyChange} 
                    placeholder="ex: 35.00"
                    autoComplete="off"
                  />
                  <div className="ds-hint">Calculado automaticamente. Não editável.</div>
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
          <div className="card" style={{ overflow: 'visible' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="step-badge">2</span>
                <h2>Cenário de precificação</h2>
              </div>
              <button onClick={() => openTutorialStep(6)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: '11px', opacity: 0.7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Explicar
              </button>
            </div>
            <div className="card-body">
              <div className="scenario-grid">
                {[
                  { value: 0.30, label: 'Conservador', pct: '30%', why: 'Para conquistar clientes iniciais.' },
                  { value: 0.50, label: 'Moderado',    pct: '50%', why: 'Equilíbrio (recomendado).' },
                  { value: 1.00, label: 'Agressivo',   pct: '100%', why: 'Dobra a margem no markup.' },
                ].map(({ value, label, pct, why }) => (
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
          <div className="card" style={{ overflow: 'visible' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="step-badge">3</span>
                <h2>Serviços incluídos no contrato</h2>
              </div>
              <button onClick={() => openTutorialStep(4)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: '11px', opacity: 0.7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Explicar
              </button>
            </div>
            <div className="card-body">
            <div style={{ overflow: 'visible' }}>
                <table className="svc-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                              {svc.tip && <span className="tt tt-left" data-tip={svc.tip}>?</span>}
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
                          <td>
                            <button type="button" className="btn-rm" onClick={() => remove(index)}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="add-row">
                <div className="field">
                  <div className="field-label">Nome do serviço</div>
                  <input type="text" value={newSvcName} onChange={e => setNewSvcName(e.target.value)} placeholder="Ex: Conciliação diária" />
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
                  <input type="number" value={newSvcNum} onChange={e => setNewSvcNum(Number(e.target.value))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button type="button" onClick={handleAddNew} className="btn btn-black" style={{ width: '100%', height: '42px' }}>Adicionar</button>
                </div>
              </div>
            </div>
          </div>

          {/* PASSO 4 — Prazo */}
          <div className="card" style={{ marginBottom: '80px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="step-badge">4</span>
                <h2>Prazo de pagamento</h2>
              </div>
              <button onClick={() => openTutorialStep(7)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ fontSize: '11px', opacity: 0.7 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                Explicar
              </button>
            </div>
            <div className="card-body">
              <div className="term-grid">
                {[
                  { value: 0,    label: 'Mensal',     disc: '0% desc.', tip: 'Sem desconto. Flexibilidade total para o cliente.' },
                  { value: 0.05, label: 'Trimestral', disc: '5% desc.', tip: '3 meses garantidos. Equilíbrio entre risco e benefício.' },
                  { value: 0.10, label: 'Anual',      disc: '10% desc.', tip: '12 meses garantidos. Melhor previsibilidade de caixa.' },
                ].map(({ value, label, disc, tip }) => (
                  <button key={value} type="button" className={`term-btn ${currentTerm === value ? 'active' : ''}`} onClick={() => setValue('term_discount', value)}>
                    <span className="tt" data-tip={tip} style={{ position: 'absolute', top: '8px', left: '8px' }}>?</span>
                    <div className="t-name" style={{ marginTop: '8px' }}>{label}</div>
                    <div className="t-disc">{disc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY BAR (BOTTOM) */}
      <div className="calculator-summary-bar">
        <div className="summary-bar__main">
          <span className="summary-bar__label">Total Mensal Sugerido</span>
          <span className="summary-bar__value">{fmt(pricing?.final_price ?? 0)}</span>
        </div>

        <div className="summary-bar__stats">
          <div className="summary-bar__stat-item">
            <span className="summary-bar__stat-lbl">Margem</span>
            <span className="summary-bar__stat-val">{(currentScenario * 100).toFixed(0)}%</span>
          </div>
          <div className="summary-bar__stat-item">
            <span className="summary-bar__stat-lbl">Prazo</span>
            <span className="summary-bar__stat-val">
              {currentTerm === 0.1 ? 'Anual' : currentTerm === 0.05 ? 'Trimestral' : 'Mensal'}
            </span>
          </div>
          <div className="summary-bar__stat-item">
            <span className="summary-bar__stat-lbl">Serviços</span>
            <span className="summary-bar__stat-val">
              {watchedValues?.services?.filter(s => s.active).length || 0}
            </span>
          </div>
        </div>

        <div className="summary-bar__actions" style={{ display: 'flex', alignItems: 'center' }}>
          {!hasActiveService && (
             <div style={{ color: '#ef4444', fontSize: '13px', marginRight: '16px', fontWeight: 600 }}>
               ⚠️ Ative pelo menos um serviço
             </div>
          )}
          <button 
            className="ds-btn ds-btn-ghost" 
            onClick={handleDownload}
            disabled={!pricing || isGenerating || !hasActiveService || !isClientValid}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isGenerating ? 'Gerando...' : 'Baixar Proposta'}
          </button>
          
          <button 
            className="ds-btn ds-btn-primary" 
            onClick={handlePrimaryAction}
            disabled={!pricing || isSaving || !hasActiveService || !isClientValid}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            {isSaving ? 'Salvando...' : saveButtonLabel}
          </button>
        </div>
      </div>

      {/* ─── TUTORIAL PANEL ──────────────────────────────────────────────────────── */}
      <div className={`tutorial-overlay ${showTutorial ? 'open' : ''}`} onClick={() => setShowTutorial(false)} />
      <div className={`tutorial-panel ${showTutorial ? 'open' : ''}`}>
        <div className="tutorial-panel__header">
          <div>
            <h2>Guia de Precificação</h2>
            <p>Metodologia oficial Café com BPO</p>
          </div>
          <button onClick={() => setShowTutorial(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="tutorial-panel__content">
          {tutorialSteps.map(step => (
            <div key={step.id} style={{ display: currentStep === step.id ? 'block' : 'none' }}>
              <div className="tutorial-panel__step-tag">{step.tag}</div>
              <h3 className="tutorial-panel__title">{step.title}</h3>
              <p className="tutorial-panel__text">{step.text}</p>
              
              <ul className="tutorial-panel__checklist">
                {step.items.map((item, idx) => <li key={idx}>{item}</li>)}
              </ul>

              {step.example && (
                <div className="tutorial-panel__example">
                  <div className="tutorial-panel__example-label">Exemplo Real</div>
                  <p className="tutorial-panel__example-text">{step.example}</p>
                </div>
              )}

              {step.insight && (
                <div className="tutorial-panel__insight">
                  <strong>Sacada Extra</strong>
                  <p>{step.insight}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="tutorial-panel__footer">
          <div style={{ color: '#64748b', fontSize: '13px' }}>Passo {currentStep} de {tutorialSteps.length}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="ds-btn ds-btn-ghost ds-btn-sm" 
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              Anterior
            </button>
            <button 
              className="ds-btn ds-btn-primary ds-btn-sm" 
              onClick={currentStep === tutorialSteps.length ? () => setShowTutorial(false) : nextStep}
              style={{ fontWeight: 700 }}
            >
              {currentStep === tutorialSteps.length ? 'Entendi!' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
