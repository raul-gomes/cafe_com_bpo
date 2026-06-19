import React, { useState } from 'react';
import { Plus, X, Edit2, Trash2, GripVertical, Settings } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { TaskPhaseResponse } from '../../schemas/tasks';
import { useConfirm } from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[480px] overflow-auto rounded-lg border border-border bg-card shadow-2xl"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-primary" />
            <h2 className="m-0 text-[18px] font-bold text-foreground">Gerenciar Fases</h2>
          </div>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="mb-5 text-[13px] text-muted-foreground">
            Personalize as colunas do seu Kanban. Arraste para reordenar.
          </p>

          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              Carregando fases...
            </div>
          ) : (
            <div className="mb-5 flex flex-col gap-2">
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
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-all',
                    editingPhase?.id === phase.id ? 'bg-muted' : 'bg-card',
                    draggedPhase === phase.id && 'opacity-50',
                    phase.is_default ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                  )}
                >
                  {!phase.is_default ? (
                    <GripVertical size={16} className="text-muted-foreground" />
                  ) : (
                    <div className="w-4" />
                  )}
                  <div className="size-6 shrink-0 rounded-full" style={{ background: phase.color }} />
                  <span className="flex-1 text-[14px] font-semibold text-foreground">{phase.name}</span>
                  {phase.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Padrão
                    </span>
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(phase)}
                      className="cursor-pointer border-none bg-transparent p-1 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 size={14} />
                    </button>
                    {!phase.is_default && (
                      <button
                        onClick={() => handleDelete(phase)}
                        className="cursor-pointer border-none bg-transparent p-1 text-destructive hover:opacity-80"
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
            <div className="mb-4 rounded-lg border border-border bg-muted p-4">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da fase"
                className="mb-3 w-full rounded-sm border border-border bg-card px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-colors focus:border-primary"
                autoFocus
              />
              <div className="mb-3">
                <label className="mb-2 block text-[12px] font-semibold text-muted-foreground">
                  Cor
                </label>
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className="size-7 cursor-pointer rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        background: color,
                        borderColor: newColor === color ? '#fff' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowCreate(false); setEditingPhase(null); setNewName(''); }}
                  className="rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={editingPhase ? handleUpdate : handleCreate}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  disabled={!newName.trim() || createPhase.isPending || updatePhase.isPending}
                >
                  {editingPhase ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setShowCreate(true); setNewName(''); setNewColor('#6b7280'); }}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted/80"
            >
              <Plus size={16} /> Nova Fase
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
