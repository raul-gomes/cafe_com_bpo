import React, { useState } from 'react';
import { Plus, Settings, X, ChevronRight, ToggleLeft, ToggleRight, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

export const TemplateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { useTemplatesList, useCreateTemplate, useUpdateTemplate, useDeleteTemplate } = useTasks();
  const { data: templates, isLoading } = useTemplatesList();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('fiscal');
  const [newRecurrence, setNewRecurrence] = useState('monthly');

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createTemplate.mutateAsync({
      name: newName.trim(),
      process_type: newType,
      recurrence: newRecurrence,
    });
    setNewName('');
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
        <button className="ds-btn ds-btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> Nova Rotina
        </button>
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
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>Nome</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Fiscal Mensal"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>Tipo</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }}
              >
                {Object.entries(PROCESS_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '6px' }}>Periodicidade</label>
              <select
                value={newRecurrence}
                onChange={(e) => setNewRecurrence(e.target.value)}
                style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--ds-border)', background: 'var(--ds-surface)', color: 'var(--ds-text)', fontSize: '14px' }}
              >
                {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
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
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(59,130,246,0.1)', color: 'var(--ds-primary)', fontWeight: 700 }}>
                    {PROCESS_TYPE_LABELS[tmpl.process_type || ''] || tmpl.process_type}
                  </span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 700 }}>
                    {RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ds-text-muted)' }}>
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
    </div>
  );
};
