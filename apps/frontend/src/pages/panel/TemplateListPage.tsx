import React, { useState } from 'react';
import { Plus, Settings, X, ChevronRight, ToggleLeft, ToggleRight, FileText, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../../api/hooks/useTasks';
import { Breadcrumb } from '../../components/ui/Breadcrumb';

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma só vez',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

const WEEKDAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
];

const MONTH_OPTIONS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const inputStyle: React.CSSProperties = {
  padding: '10px 14px',
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
  marginBottom: '6px',
};

export const TemplateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { useTemplatesList, useCreateTemplate, useUpdateTemplate, useDeleteTemplate, useRoutineTypes, useCreateRoutineType, useUpdateRoutineType, useDeleteRoutineType } = useTasks();
  const { data: templates, isLoading } = useTemplatesList();
  const { data: routineTypes, isLoading: typesLoading } = useRoutineTypes();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const createRoutineType = useCreateRoutineType();
  const updateRoutineType = useUpdateRoutineType();
  const deleteRoutineType = useDeleteRoutineType();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRoutineTypeId, setNewRoutineTypeId] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('monthly');
  const [newDaysFromStart, setNewDaysFromStart] = useState<number | ''>('');
  const [newDueDay, setNewDueDay] = useState<number | ''>('');
  const [newDueMonth, setNewDueMonth] = useState<number | ''>('');
  const [newWeekdays, setNewWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [typeEdit, setTypeEdit] = useState<{ id?: string; name: string; color: string }>({ name: '', color: '#3b82f6' });

  const toggleWeekday = (day: number) => {
    setNewWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    );
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const payload: Record<string, unknown> = {
      name: newName.trim(),
      recurrence: newRecurrence,
    };
    if (newRoutineTypeId) {
      payload.routine_type_id = newRoutineTypeId;
    }
    if (newRecurrence === 'once') {
      payload.due_days_from_start = newDaysFromStart === '' ? undefined : Number(newDaysFromStart);
    }
    if (newRecurrence === 'weekly') {
      payload.weekday_mask = newWeekdays.join(',');
    }
    if (newRecurrence === 'monthly') {
      payload.due_day = newDueDay === '' ? undefined : Number(newDueDay);
    }
    if (newRecurrence === 'yearly') {
      payload.due_day = newDueDay === '' ? undefined : Number(newDueDay);
      payload.due_month = newDueMonth === '' ? undefined : Number(newDueMonth);
    }
    await createTemplate.mutateAsync(payload as any);
    setNewName('');
    setNewDaysFromStart('');
    setNewDueDay('');
    setNewDueMonth('');
    setNewWeekdays([1, 2, 3, 4, 5]);
    setShowCreate(false);
  };

  const toggleActive = async (template: any) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      is_active: !template.is_active,
    });
  };

  if (isLoading) {
    return (
      <div className="tasks-page">
        <div className="panel-skeleton" style={{ height: '32px', width: '200px', marginBottom: '40px' }} />
        <div className="panel-skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  return (
    <div className="tasks-page" style={{ animation: 'panelFadeIn 0.4s ease-out' }}>
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Rotinas' }]} />

      <div className="panel-content__header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Rotinas</h1>
          <p>Rotinas de atividades recorrentes que podem ser vinculadas a clientes.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ds-btn ds-btn-secondary" onClick={() => setShowTypeManager(true)}>
            <Settings size={18} /> Tipos
          </button>
          <button className="ds-btn ds-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Nova Rotina
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="ds-card" style={{ padding: '20px', marginBottom: '24px', border: '1px solid var(--ds-primary-low)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Nova Rotina</h3>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={labelStyle}>Nome</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Fiscal Mensal"
                style={{ width: '100%', ...inputStyle }}
                autoFocus
              />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select
                value={newRoutineTypeId}
                onChange={(e) => setNewRoutineTypeId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Selecione um tipo</option>
                {routineTypes?.map((rt) => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Periodicidade</label>
              <select
                value={newRecurrence}
                onChange={(e) => {
                  setNewRecurrence(e.target.value);
                  setNewDaysFromStart('');
                  setNewDueDay('');
                  setNewDueMonth('');
                  setNewWeekdays([1, 2, 3, 4, 5]);
                }}
                style={inputStyle}
              >
                {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {newRecurrence === 'once' && (
              <div>
                <label style={labelStyle}>Dias para execução</label>
                <input
                  type="number"
                  min={1}
                  value={newDaysFromStart}
                  onChange={(e) => setNewDaysFromStart(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 30"
                  style={{ width: '100px', ...inputStyle }}
                />
              </div>
            )}
            {newRecurrence === 'weekly' && (
              <div>
                <label style={labelStyle}>Dias da semana</label>
                <div style={{ display: 'flex', gap: '6px', paddingTop: '4px' }}>
                  {WEEKDAY_LABELS.map(({ value, label }) => (
                    <label
                      key={value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                        background: newWeekdays.includes(value) ? 'var(--ds-primary-low)' : 'var(--ds-surface-2)',
                        border: `1px solid ${newWeekdays.includes(value) ? 'var(--ds-primary)' : 'var(--ds-border)'}`,
                        cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                        color: newWeekdays.includes(value) ? 'var(--ds-primary)' : 'var(--ds-text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newWeekdays.includes(value)}
                        onChange={() => toggleWeekday(value)}
                        style={{ display: 'none' }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {newRecurrence === 'monthly' && (
              <div>
                <label style={labelStyle}>Dia do vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={newDueDay}
                  onChange={(e) => setNewDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 15"
                  style={{ width: '100px', ...inputStyle }}
                />
              </div>
            )}
            {newRecurrence === 'yearly' && (
              <>
                <div>
                  <label style={labelStyle}>Dia</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={newDueDay}
                    onChange={(e) => setNewDueDay(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Ex: 15"
                    style={{ width: '80px', ...inputStyle }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Mês</label>
                  <select
                    value={newDueMonth}
                    onChange={(e) => setNewDueMonth(e.target.value === '' ? '' : Number(e.target.value))}
                    style={inputStyle}
                  >
                    <option value="">Selecione</option>
                    {MONTH_OPTIONS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleCreate}
              disabled={!newName.trim() || createTemplate.isPending}
              style={{ marginBottom: 0 }}
            >
              Criar Rotina
            </button>
          </div>
        </div>
      )}

      {!templates || templates.length === 0 ? (
        <div className="panel-card" style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Settings size={48} style={{ color: 'var(--ds-text-muted)', opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Nenhuma rotina criada</h3>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: '14px', marginBottom: '20px' }}>
            Crie rotinas de atividades recorrentes para agilizar o onboarding de novos clientes.
          </p>
          <button className="ds-btn ds-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Criar Primeira Rotina
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="ds-card"
              style={{
                padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: '16px',
                opacity: tmpl.is_active ? 1 : 0.5,
              }}
              onClick={() => navigate(`/painel/templates-atividades/${tmpl.id}`)}
            >
              <FileText size={24} style={{ color: 'var(--ds-primary)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>{tmpl.name}</span>
                  {tmpl.routine_type_name && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: (tmpl.routine_type_color || '#3b82f6') + '20', color: tmpl.routine_type_color || '#3b82f6', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tmpl.routine_type_color || '#3b82f6', display: 'inline-block' }} />
                      {tmpl.routine_type_name}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>
                    {RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence}
                  </span>
                  {tmpl.is_overdue && (tmpl.days_overdue ?? 0) > 0 && (
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> Atrasado {tmpl.days_overdue ?? 0}d
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {tmpl.recurrence === 'once' && tmpl.due_days_from_start && (
                    <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '12px', background: 'rgba(107,114,128,0.1)', color: '#6b7280', fontWeight: 600 }}>
                      {tmpl.due_days_from_start} dias p/ execução
                    </span>
                  )}
                  {tmpl.recurrence === 'weekly' && tmpl.weekday_mask && (
                    <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '12px', background: 'rgba(107,114,128,0.1)', color: '#6b7280', fontWeight: 600 }}>
                      {tmpl.weekday_mask.split(',').map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(d)]).join(', ')}
                    </span>
                  )}
                  {tmpl.recurrence === 'monthly' && tmpl.due_day && (
                    <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '12px', background: 'rgba(107,114,128,0.1)', color: '#6b7280', fontWeight: 600 }}>
                      Vence dia {tmpl.due_day}
                    </span>
                  )}
                  {tmpl.recurrence === 'yearly' && tmpl.due_day && (
                    <span style={{ fontSize: '12px', padding: '2px 10px', borderRadius: '12px', background: 'rgba(107,114,128,0.1)', color: '#6b7280', fontWeight: 600 }}>
                      Vence {tmpl.due_day}/{tmpl.due_month}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ds-text-muted)', marginTop: '4px' }}>
                  {tmpl.activity_count} atividade(s) • {tmpl.description || 'Sem descrição'}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleActive(tmpl); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: tmpl.is_active ? 'var(--ds-success)' : 'var(--ds-text-muted)' }}
                title={tmpl.is_active ? 'Desativar' : 'Ativar'}
              >
                {tmpl.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Excluir template "${tmpl.name}"?`)) {
                    deleteTemplate.mutate(tmpl.id);
                  }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-error)', padding: '4px' }}
                title="Excluir"
              >
                <X size={16} />
              </button>
              <ChevronRight size={18} style={{ color: 'var(--ds-text-muted)' }} />
            </div>
          ))}
        </div>
      )}
      {/* ── Type Manager Modal ── */}
      {showTypeManager && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
          onClick={() => setShowTypeManager(false)}
        >
          <div
            className="ds-card"
            style={{ maxWidth: '500px', width: '100%', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Gerenciar Tipos de Rotina</h3>
              <button onClick={() => setShowTypeManager(false)} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Add / Edit form */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                value={typeEdit.name}
                onChange={(e) => setTypeEdit((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do tipo"
                style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }}
              />
              <input
                type="color"
                value={typeEdit.color}
                onChange={(e) => setTypeEdit((prev) => ({ ...prev, color: e.target.value }))}
                style={{ width: '40px', height: '40px', padding: '2px', border: '1px solid var(--ds-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              />
              {typeEdit.id ? (
                <>
                  <button
                    className="ds-btn ds-btn-primary"
                    onClick={async () => {
                      if (!typeEdit.name.trim() || !typeEdit.id) return;
                      await updateRoutineType.mutateAsync({ id: typeEdit.id, name: typeEdit.name.trim(), color: typeEdit.color });
                      setTypeEdit({ name: '', color: '#3b82f6' });
                    }}
                    disabled={!typeEdit.name.trim() || updateRoutineType.isPending}
                  >
                    Salvar
                  </button>
                  <button
                    className="ds-btn"
                    onClick={() => setTypeEdit({ name: '', color: '#3b82f6' })}
                    style={{ border: '1px solid var(--ds-border)' }}
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  className="ds-btn ds-btn-primary"
                  onClick={async () => {
                    if (!typeEdit.name.trim()) return;
                    await createRoutineType.mutateAsync({ name: typeEdit.name.trim(), color: typeEdit.color });
                    setTypeEdit({ name: '', color: '#3b82f6' });
                  }}
                  disabled={!typeEdit.name.trim() || createRoutineType.isPending}
                >
                  Adicionar
                </button>
              )}
            </div>

            {/* Existing types list */}
            {typesLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ds-text-muted)' }}>Carregando...</div>
            ) : !routineTypes || routineTypes.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--ds-text-muted)' }}>Nenhum tipo cadastrado.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {routineTypes.map((rt) => (
                  <div
                    key={rt.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--ds-surface-2)',
                    }}
                  >
                    <div
                      style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: rt.color || '#3b82f6', flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{rt.name}</span>
                    <button
                      onClick={() => setTypeEdit({ id: rt.id, name: rt.name, color: rt.color || '#3b82f6' })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-primary)', padding: '4px', fontSize: '13px' }}
                      title="Editar"
                    >
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm(`Excluir tipo "${rt.name}"?`)) {
                          await deleteRoutineType.mutateAsync(rt.id);
                        }
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-error)', padding: '4px' }}
                      title="Excluir"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
