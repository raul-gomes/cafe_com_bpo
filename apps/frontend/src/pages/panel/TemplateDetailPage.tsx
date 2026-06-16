import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit2, GripVertical } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { useConfirm } from '../../components/ui/ConfirmDialog';

const PROCESS_TYPE_LABELS: Record<string, string> = {
  fiscal: 'Fiscal',
  contabil: 'Contábil',
  dp: 'DP',
  financeiro: 'Financeiro',
  administrativo: 'Administrativo',
};

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma só vez',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: '🔵 Baixa' },
  { value: 'medium', label: '🟡 Média' },
  { value: 'high', label: '🔴 Alta' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: '#3b82f6',
  medium: '#eab308',
  high: '#ef4444',
};

export const TemplateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { useTemplate, useUpdateTemplate, useCreateActivity, useUpdateActivity, useDeleteActivity, useReorderActivities, useRoutineTypes } = useTasks();
  const { data: template, isLoading } = useTemplate(id!);
  const { data: routineTypes } = useRoutineTypes();
  const updateTemplate = useUpdateTemplate();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const reorderActivities = useReorderActivities();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newActName, setNewActName] = useState('');
  const [newActDescription, setNewActDescription] = useState('');
  const [newActPriority, setNewActPriority] = useState('medium');
  const [newActHours, setNewActHours] = useState<number | ''>('');
  const [editingAct, setEditingAct] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editHours, setEditHours] = useState<number | ''>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgDescription, setCfgDescription] = useState('');
  const [cfgDueDay, setCfgDueDay] = useState<number | ''>('');
  const [cfgDueMonth, setCfgDueMonth] = useState<number | ''>('');
  const [cfgDueDaysFromStart, setCfgDueDaysFromStart] = useState<number | ''>('');
  const [cfgWeekdays, setCfgWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [cfgRecurrence, setCfgRecurrence] = useState('monthly');
  const [cfgProcessType, setCfgProcessType] = useState('');
  const [cfgRoutineTypeId, setCfgRoutineTypeId] = useState('');
  const confirm = useConfirm();

  useEffect(() => {
    if (template) {
      setCfgDescription(template.description || '');
      setCfgDueDay(template.due_day ?? '');
      setCfgDueMonth(template.due_month ?? '');
      setCfgDueDaysFromStart(template.due_days_from_start ?? '');
      if (template.weekday_mask) {
        setCfgWeekdays(template.weekday_mask.split(',').map(Number));
      } else {
        setCfgWeekdays([1, 2, 3, 4, 5]);
      }
      setCfgRecurrence(template.recurrence);
      setCfgProcessType(template.process_type || '');
      setCfgRoutineTypeId(template.routine_type_id || '');
    }
  }, [template]);

  const WEEKDAY_LABELS = [
    { value: 1, label: 'Seg' },
    { value: 2, label: 'Ter' },
    { value: 3, label: 'Qua' },
    { value: 4, label: 'Qui' },
    { value: 5, label: 'Sex' },
  ];

  const MONTH_OPTIONS = [
    { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
  ];

  const toggleWeekday = (day: number) => {
    setCfgWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const saveConfig = async () => {
    const payload: Record<string, unknown> = {
      id: id!,
      description: cfgDescription.trim() || undefined,
      process_type: cfgProcessType || undefined,
      routine_type_id: cfgRoutineTypeId || undefined,
    };
    if (cfgRecurrence === 'once') {
      payload.due_days_from_start = cfgDueDaysFromStart === '' ? undefined : Number(cfgDueDaysFromStart);
    }
    if (cfgRecurrence === 'weekly') {
      payload.weekday_mask = cfgWeekdays.join(',');
    }
    if (cfgRecurrence === 'monthly') {
      payload.due_day = cfgDueDay === '' ? undefined : Number(cfgDueDay);
    }
    if (cfgRecurrence === 'yearly') {
      payload.due_day = cfgDueDay === '' ? undefined : Number(cfgDueDay);
      payload.due_month = cfgDueMonth === '' ? undefined : Number(cfgDueMonth);
    }
    await updateTemplate.mutateAsync(payload as any);
    setShowConfig(false);
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    await updateTemplate.mutateAsync({ id: id!, name: nameValue.trim() });
    setEditingName(false);
  };

  const handleAddActivity = async () => {
    if (!newActName.trim()) return;
    await createActivity.mutateAsync({
      template_id: id!,
      name: newActName.trim(),
      description: newActDescription.trim() || undefined,
      priority: newActPriority,
      estimated_minutes: newActHours === '' ? undefined : Number(newActHours),
      order: template?.activities?.length || 0,
    });
    setNewActName('');
    setNewActDescription('');
    setNewActPriority('medium');
    setNewActHours('');
    setShowAdd(false);
  };

  const startEdit = (act: any) => {
    setEditingAct(act.id);
    setEditName(act.name);
    setEditDescription(act.description || '');
    setEditPriority(act.priority || 'medium');
    setEditHours(act.estimated_minutes ?? '');
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingAct) return;
    await updateActivity.mutateAsync({
      template_id: id!,
      id: editingAct,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      priority: editPriority,
      estimated_minutes: editHours === '' ? undefined : Number(editHours),
    });
    setEditingAct(null);
  };

  if (isLoading) {
    return (
      <div className="tasks-page">
        <div className="panel-skeleton" style={{ height: '32px', width: '200px', marginBottom: '40px' }} />
        <div className="panel-skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="tasks-page">
        <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <h3>Rotina não encontrada</h3>
          <button className="ds-btn ds-btn-ghost" onClick={() => navigate('/painel/templates-atividades')} style={{ marginTop: '12px' }}>
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  const sortedActivities = [...(template.activities || [])].sort((a, b) => a.order - b.order);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--ds-border)',
    background: 'var(--ds-surface)',
    color: 'var(--ds-text)',
    fontSize: '14px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--ds-text-muted)',
    display: 'block',
    marginBottom: '4px',
  };

  return (
    <div className="tasks-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      <Breadcrumb items={[
        { label: 'Painel', to: '/painel' },
        { label: 'Rotinas', to: '/painel/templates-atividades' },
        { label: template.name },
      ]} />

      <div style={{ marginBottom: '16px' }}>
        <button className="ds-btn ds-btn-ghost" onClick={() => navigate('/painel/templates-atividades')} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
      </div>

      {/* Header */}
      <div className="panel-content__header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '20px', fontWeight: 700, maxWidth: '300px' }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); }}
              />
              <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={saveName}>Salvar</button>
              <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setEditingName(false)}>Cancelar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1>{template.name}</h1>
              <button onClick={() => { setEditingName(true); setNameValue(template.name); }} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
                <Edit2 size={16} />
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', color: 'var(--ds-primary)', fontWeight: 700 }}>
              {PROCESS_TYPE_LABELS[template.process_type || ''] || template.process_type}
            </span>
            <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>
              {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
            </span>
            {template.description && (
              <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)' }}>{template.description}</span>
            )}
          </div>
          {/* Recurrence details — always visible */}
          {template.recurrence === 'once' && template.due_days_from_start && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Prazo: <strong>{template.due_days_from_start} dias</strong> após o start</span>
            </div>
          )}
          {template.recurrence === 'weekly' && template.weekday_mask && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Dias: <strong>{template.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}</strong></span>
            </div>
          )}
          {template.recurrence === 'monthly' && template.due_day && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Vencimento: <strong>dia {template.due_day}</strong> de cada mês</span>
            </div>
          )}
          {template.recurrence === 'yearly' && template.due_day && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Vencimento: <strong>dia {template.due_day}/{template.due_month}</strong> anualmente</span>
            </div>
          )}
        </div>
      </div>

      {/* Template Config */}
      <div className="ds-card" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Configurações da Rotina</h3>
          <button className="ds-btn ds-btn-sm" onClick={() => setShowConfig(!showConfig)} style={{ border: '1px solid var(--ds-border)' }}>
            {showConfig ? 'Cancelar' : <><Edit2 size={14} /> Editar</>}
          </button>
        </div>
        {showConfig ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea
                value={cfgDescription}
                onChange={(e) => setCfgDescription(e.target.value)}
                placeholder="Descrição da rotina..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <label style={labelStyle}>Tipo de Processo</label>
                <select value={cfgProcessType} onChange={(e) => setCfgProcessType(e.target.value)} style={inputStyle}>
                  <option value="">Selecione</option>
                  {Object.entries(PROCESS_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo de Rotina</label>
                <select value={cfgRoutineTypeId} onChange={(e) => setCfgRoutineTypeId(e.target.value)} style={inputStyle}>
                  <option value="">Sem tipo</option>
                  {routineTypes?.map(rt => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {cfgRecurrence === 'once' && (
              <div>
                <label style={labelStyle}>Dias para execução</label>
                <input
                  type="number" min={1}
                  value={cfgDueDaysFromStart}
                  onChange={(e) => setCfgDueDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 30"
                  style={{ width: '120px', ...inputStyle }}
                />
              </div>
            )}
            {cfgRecurrence === 'weekly' && (
              <div>
                <label style={labelStyle}>Dias da semana</label>
                <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
                  {WEEKDAY_LABELS.map(({ value, label }) => (
                    <label key={value} style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: cfgWeekdays.includes(value) ? 'var(--ds-primary-low)' : 'var(--ds-surface-2)',
                      border: `1px solid ${cfgWeekdays.includes(value) ? 'var(--ds-primary)' : 'var(--ds-border)'}`,
                      cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                      color: cfgWeekdays.includes(value) ? 'var(--ds-primary)' : 'var(--ds-text-muted)',
                      transition: 'all 0.15s',
                    }}>
                      <input type="checkbox" checked={cfgWeekdays.includes(value)} onChange={() => toggleWeekday(value)} style={{ display: 'none' }} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {cfgRecurrence === 'monthly' && (
              <div>
                <label style={labelStyle}>Dia do vencimento</label>
                <input
                  type="number" min={1} max={31}
                  value={cfgDueDay}
                  onChange={(e) => setCfgDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 15"
                  style={{ width: '100px', ...inputStyle }}
                />
              </div>
            )}
            {cfgRecurrence === 'yearly' && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Dia</label>
                  <input
                    type="number" min={1} max={31}
                    value={cfgDueDay}
                    onChange={(e) => setCfgDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 15"
                    style={{ width: '80px', ...inputStyle }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mês</label>
                  <select value={cfgDueMonth} onChange={(e) => setCfgDueMonth(e.target.value === '' ? '' : Number(e.target.value))} style={inputStyle}>
                    <option value="">Selecione</option>
                    {MONTH_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div>
              <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={saveConfig} disabled={updateTemplate.isPending}>
                Salvar Configurações
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', fontSize: '13px' }}>
            {template.description && (
              <span style={{ color: 'var(--ds-text-muted)' }}>{template.description}</span>
            )}
            <span style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', color: 'var(--ds-primary)', fontWeight: 700 }}>
              {PROCESS_TYPE_LABELS[template.process_type || ''] || template.process_type || 'Sem tipo'}
            </span>
            {template.routine_type_id && routineTypes && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>
                {(() => {
                  const rt = routineTypes.find(r => r.id === template.routine_type_id);
                  return rt ? <>{rt.name}</> : null;
                })()}
              </span>
            )}
            <span style={{ color: 'var(--ds-text-muted)' }}>
              {RECURRENCE_LABELS[template.recurrence] || template.recurrence}
            </span>
            {template.recurrence === 'weekly' && template.weekday_mask && (
              <span style={{ color: 'var(--ds-text-muted)' }}>
                {template.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}
              </span>
            )}
            {template.recurrence === 'monthly' && template.due_day && (
              <span style={{ color: 'var(--ds-text-muted)' }}>Dia {template.due_day}</span>
            )}
            {template.recurrence === 'yearly' && template.due_day && (
              <span style={{ color: 'var(--ds-text-muted)' }}>
                {template.due_day}/{template.due_month}
              </span>
            )}
            {template.recurrence === 'once' && template.due_days_from_start && (
              <span style={{ color: 'var(--ds-text-muted)' }}>{template.due_days_from_start} dias p/ execução</span>
            )}
          </div>
        )}
      </div>

      {/* Activities */}
      <div className="ds-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Atividades da Rotina</h3>
          <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Adicionar Atividade
          </button>
        </div>

        {showAdd && (
          <div style={{ padding: '16px', background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid var(--ds-primary-low)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={labelStyle}>Título da Tarefa</label>
                  <input type="text" value={newActName} onChange={(e) => setNewActName(e.target.value)} placeholder="Ex: Apuração de tributos" style={inputStyle} />
                </div>
                <div style={{ minWidth: '140px' }}>
                  <label style={labelStyle}>Prioridade</label>
                  <select
                    value={newActPriority}
                    onChange={(e) => setNewActPriority(e.target.value)}
                    style={inputStyle}
                  >
                    {PRIORITY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Minutos Estimados</label>
                  <input type="number" min={0} value={newActHours} onChange={(e) => setNewActHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                    style={{ width: '80px', ...inputStyle }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Descrição</label>
                <textarea
                  value={newActDescription}
                  onChange={(e) => setNewActDescription(e.target.value)}
                  placeholder="Passo a passo da atividade..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={handleAddActivity} disabled={!newActName.trim() || createActivity.isPending}>
                  Adicionar
                </button>
                <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setShowAdd(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {sortedActivities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ds-text-muted)' }}>
            Nenhuma atividade nesta rotina. Adicione atividades para que sejam geradas automaticamente ao vincular a um cliente.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sortedActivities.map((act, idx) => (
              <div
                key={act.id}
                draggable
                onDragStart={() => setDraggedId(act.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (draggedId && draggedId !== act.id) {
                    const ids = sortedActivities.map(a => a.id);
                    const dragIdx = ids.indexOf(draggedId);
                    const dropIdx = ids.indexOf(act.id);
                    ids.splice(dragIdx, 1);
                    ids.splice(dropIdx, 0, draggedId);
                    await reorderActivities.mutateAsync({ template_id: id!, ordered_ids: ids });
                  }
                  setDraggedId(null);
                }}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: editingAct === act.id ? 'var(--ds-surface-2)' : 'var(--ds-surface-1)',
                  border: '1px solid var(--ds-border)',
                  opacity: draggedId === act.id ? 0.5 : 1,
                }}
              >
                {editingAct === act.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        style={{ flex: 1, minWidth: '150px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '13px' }} />
                      <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '13px' }}>
                        {PRIORITY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '13px', color: 'var(--ds-text-muted)' }}>
                        ⏱
                        <input type="number" min={0} value={editHours} onChange={(e) => setEditHours(e.target.value === '' ? '' : Number(e.target.value))}
                          style={{ width: '60px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '13px', textAlign: 'center' }} />
                        min
                      </div>
                    </div>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Descrição da atividade..."
                      rows={2}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={saveEdit} disabled={updateActivity.isPending}>Salvar</button>
                      <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setEditingAct(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <GripVertical size={16} style={{ color: 'var(--ds-text-muted)', cursor: 'grab', flexShrink: 0, marginTop: '2px' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-muted)', minWidth: '24px', marginTop: '2px' }}>{idx + 1}.</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>{act.name}</span>
                          <span style={{
                            fontSize: '11px', padding: '1px 8px', borderRadius: '10px',
                            fontWeight: 700, color: '#fff',
                            background: PRIORITY_COLORS[act.priority] || '#6b7280',
                          }}>
                            {PRIORITY_OPTIONS.find(p => p.value === act.priority)?.label.split(' ')[1] || act.priority}
                          </span>
                          {act.due_day && (
                            <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                              📅 Dia {act.due_day}
                            </span>
                          )}
                          {act.estimated_minutes && (
                            <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                              ⏱ {act.estimated_minutes}min
                            </span>
                          )}
                        </div>
                        {act.description && (
                          <p style={{ fontSize: '13px', color: 'var(--ds-text-muted)', marginTop: '4px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                            {act.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginTop: '2px' }}>
                        <button onClick={() => startEdit(act)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-muted)', padding: '4px' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={async () => {
                          const ok = await confirm({
                            title: 'Remover atividade',
                            message: `Remover "${act.name}"?`,
                            variant: 'danger',
                            confirmLabel: 'Remover',
                          });
                          if (ok) deleteActivity.mutate({ template_id: id!, id: act.id });
                        }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-error)', padding: '4px' }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Usage info */}
      <div className="ds-card" style={{ padding: '20px', marginTop: '24px', background: 'rgba(59,130,246,0.03)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>Como usar esta rotina</h4>
        <p style={{ fontSize: '13px', color: 'var(--ds-text-muted)', lineHeight: 1.6 }}>
          Ao vincular esta rotina a um cliente (na página de <strong>Empresas</strong> ou diretamente na <strong>Timeline do Cliente</strong>),
          o sistema irá gerar automaticamente todas as {sortedActivities.length} atividade(s) como tarefas individuais, cada uma com seu prazo calculado.
        </p>
      </div>
    </div>
  );
};
