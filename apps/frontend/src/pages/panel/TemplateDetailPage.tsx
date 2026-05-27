import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit2, GripVertical } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { Breadcrumb } from '../../components/ui/Breadcrumb';

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
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export const TemplateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { useTemplate, useUpdateTemplate, useCreateActivity, useUpdateActivity, useDeleteActivity, useReorderActivities } = useTasks();
  const { data: template, isLoading } = useTemplate(id!);
  const updateTemplate = useUpdateTemplate();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const reorderActivities = useReorderActivities();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newActName, setNewActName] = useState('');
  const [newActDay, setNewActDay] = useState(20);
  const [newActHours, setNewActHours] = useState<number | ''>('');
  const [editingAct, setEditingAct] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDay, setEditDay] = useState(20);
  const [editHours, setEditHours] = useState<number | ''>('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

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
      due_day: newActDay,
      estimated_hours: newActHours === '' ? undefined : Number(newActHours),
      order: template?.activities?.length || 0,
    });
    setNewActName('');
    setShowAdd(false);
  };

  const startEdit = (act: any) => {
    setEditingAct(act.id);
    setEditName(act.name);
    setEditDay(act.due_day);
    setEditHours(act.estimated_hours ?? '');
  };

  const saveEdit = async () => {
    if (!editName.trim() || !editingAct) return;
    await updateActivity.mutateAsync({
      template_id: id!,
      id: editingAct,
      name: editName.trim(),
      due_day: editDay,
      estimated_hours: editHours === '' ? undefined : Number(editHours),
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
        </div>
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
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '4px' }}>Nome</label>
                <input type="text" value={newActName} onChange={(e) => setNewActName(e.target.value)} placeholder="Ex: Apuração de tributos"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '4px' }}>Vence dia</label>
                <input type="number" min={1} max={31} value={newActDay} onChange={(e) => setNewActDay(Number(e.target.value))}
                  style={{ width: '80px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '4px' }}>Horas</label>
                <input type="number" min={0} value={newActHours} onChange={(e) => setNewActHours(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0"
                  style={{ width: '80px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }} />
              </div>
              <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={handleAddActivity} disabled={!newActName.trim() || createActivity.isPending}>
                Adicionar
              </button>
              <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setShowAdd(false)}>Cancelar</button>
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
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: editingAct === act.id ? 'var(--ds-surface-2)' : 'var(--ds-surface-1)',
                  border: '1px solid var(--ds-border)',
                  opacity: draggedId === act.id ? 0.5 : 1,
                }}
              >
                <GripVertical size={16} style={{ color: 'var(--ds-text-muted)', cursor: 'grab', flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-muted)', minWidth: '24px' }}>{idx + 1}.</span>

                {editingAct === act.id ? (
                  <div style={{ display: 'flex', gap: '8px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                      style={{ flex: 1, minWidth: '150px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '13px' }} />
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '13px', color: 'var(--ds-text-muted)' }}>
                      Vence dia
                      <input type="number" min={1} max={31} value={editDay} onChange={(e) => setEditDay(Number(e.target.value))}
                        style={{ width: '60px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '13px', textAlign: 'center' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '13px', color: 'var(--ds-text-muted)' }}>
                      ⏱
                      <input type="number" min={0} value={editHours} onChange={(e) => setEditHours(e.target.value === '' ? '' : Number(e.target.value))}
                        style={{ width: '60px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '13px', textAlign: 'center' }} />
                      h
                    </div>
                    <button className="ds-btn ds-btn-primary ds-btn-sm" onClick={saveEdit} disabled={updateActivity.isPending}>Salvar</button>
                    <button className="ds-btn ds-btn-ghost ds-btn-sm" onClick={() => setEditingAct(null)}>Cancelar</button>
                  </div>
                ) : (
                  <>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: '14px' }}>{act.name}</span>
                    <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📅 Dia {act.due_day}
                    </span>
                    {act.estimated_hours && (
                      <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        ⏱ {act.estimated_hours}h
                      </span>
                    )}
                    <button onClick={() => startEdit(act)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-text-muted)', padding: '4px' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => { if (window.confirm(`Remover "${act.name}"?`)) deleteActivity.mutate({ template_id: id!, id: act.id }); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ds-error)', padding: '4px' }}>
                      <X size={14} />
                    </button>
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
