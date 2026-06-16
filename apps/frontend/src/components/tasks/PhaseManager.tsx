import React, { useState } from 'react';
import { Plus, X, Edit2, Trash2, GripVertical, Settings } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { TaskPhaseResponse } from '../../schemas/tasks';
import { useConfirm } from '../ui/ConfirmDialog';
import { useToast } from '../ui/Toast';

interface PhaseManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_COLORS = [
  '#6b7280', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
];

export const PhaseManager: React.FC<PhaseManagerProps> = ({ isOpen, onClose }) => {
  const { usePhases, useCreatePhase, useUpdatePhase, useDeletePhase, useReorderPhases } = useTasks();
  const { data: phases, isLoading } = usePhases();
  const createPhase = useCreatePhase();
  const updatePhase = useUpdatePhase();
  const deletePhase = useDeletePhase();
  const reorderPhases = useReorderPhases();

  const [showCreate, setShowCreate] = useState(false);
  const [editingPhase, setEditingPhase] = useState<TaskPhaseResponse | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6b7280');
  const [draggedPhase, setDraggedPhase] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createPhase.mutateAsync({
      name: newName.trim(),
      color: newColor,
      order: (phases?.length || 0),
    });
    setNewName('');
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!editingPhase || !newName.trim()) return;
    await updatePhase.mutateAsync({
      id: editingPhase.id,
      name: newName.trim(),
      color: newColor,
    });
    setEditingPhase(null);
  };

  const handleDelete = async (phase: TaskPhaseResponse) => {
    if (phase.is_default && (phases?.length || 0) <= 3) {
      toast.error('Não é possível excluir fases padrão quando há apenas 3 fases.');
      return;
    }
    const ok = await confirm({
      title: 'Excluir fase',
      message: `Excluir a fase "${phase.name}"? As tarefas serão movidas para outra fase.`,
      variant: 'danger',
      confirmLabel: 'Excluir',
    });
    if (ok) {
      await deletePhase.mutateAsync(phase.id);
    }
  };

  const openEdit = (phase: TaskPhaseResponse) => {
    setEditingPhase(phase);
    setNewName(phase.name);
    setNewColor(phase.color);
  };

  if (!isOpen) return null;

  const sortedPhases = [...(phases || [])].sort((a, b) => a.order - b.order);

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        className="ds-card"
        style={{
          width: '480px', maxHeight: '80vh', overflow: 'auto',
          background: 'var(--ds-surface)', border: '1px solid var(--ds-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid var(--ds-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Settings size={20} color="var(--ds-primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Gerenciar Fases</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ds-text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <p style={{ fontSize: '13px', color: 'var(--ds-text-muted)', marginBottom: '20px' }}>
            Personalize as colunas do seu Kanban. Arraste para reordenar.
          </p>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ds-text-muted)' }}>
              Carregando fases...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {sortedPhases.map((phase) => (
                <div
                  key={phase.id}
                  draggable={!phase.is_default}
                  onDragStart={() => setDraggedPhase(phase.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (draggedPhase && draggedPhase !== phase.id && phases) {
                      const current = [...phases].sort((a, b) => a.order - b.order);
                      const dragIdx = current.findIndex(p => p.id === draggedPhase);
                      const dropIdx = current.findIndex(p => p.id === phase.id);
                      const [moved] = current.splice(dragIdx, 1);
                      current.splice(dropIdx, 0, moved);
                      const reordered = current.map((p, i) => ({ id: p.id, order: i }));
                      await reorderPhases.mutateAsync(reordered);
                    }
                    setDraggedPhase(null);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: 'var(--radius-md)',
                    background: editingPhase?.id === phase.id ? 'var(--ds-surface-2)' : 'var(--ds-surface-1)',
                    border: '1px solid var(--ds-border)',
                    opacity: draggedPhase === phase.id ? 0.5 : 1,
                    cursor: phase.is_default ? 'default' : 'grab',
                  }}
                >
                  {!phase.is_default && <GripVertical size={16} color="var(--ds-text-muted)" />}
                  {phase.is_default && <div style={{ width: 16 }} />}
                  <div
                    style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: phase.color, flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>{phase.name}</span>
                  {phase.is_default && (
                    <span style={{
                      fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                      borderRadius: '12px', background: 'rgba(59,130,246,0.1)',
                      color: 'var(--ds-primary)',
                    }}>
                      Padrão
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => openEdit(phase)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--ds-text-muted)', padding: '4px',
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    {!phase.is_default && (
                      <button
                        onClick={() => handleDelete(phase)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--ds-error)', padding: '4px',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showCreate || editingPhase ? (
            <div style={{
              padding: '16px', borderRadius: 'var(--radius-md)',
              background: 'var(--ds-surface-2)', border: '1px solid var(--ds-border)',
              marginBottom: '16px',
            }}>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da fase"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--ds-border)', background: 'var(--ds-surface)',
                  color: 'var(--ds-text)', fontSize: '14px', marginBottom: '12px',
                }}
                autoFocus
              />
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-muted)', display: 'block', marginBottom: '8px' }}>
                  Cor
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: color, border: newColor === color ? '3px solid white' : '2px solid transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowCreate(false); setEditingPhase(null); setNewName(''); }}
                  className="ds-btn ds-btn-ghost ds-btn-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingPhase ? handleUpdate : handleCreate}
                  className="ds-btn ds-btn-primary ds-btn-sm"
                  disabled={!newName.trim() || createPhase.isPending || updatePhase.isPending}
                >
                  {editingPhase ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowCreate(true); setNewName(''); setNewColor('#6b7280'); }}
              className="ds-btn ds-btn-ghost"
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}
            >
              <Plus size={16} /> Nova Fase
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
