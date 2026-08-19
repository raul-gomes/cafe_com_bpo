import React, { useState } from 'react';
import { X, Edit2, Settings } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { TaskPhaseResponse } from '../../schemas/tasks';
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
  const { usePhases, useUpdatePhase } = useTasks();
  const { data: phases, isLoading } = usePhases();
  const updatePhase = useUpdatePhase();

  const [editingPhase, setEditingPhase] = useState<TaskPhaseResponse | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');

  const handleUpdate = async () => {
    if (!editingPhase || !editName.trim()) return;
    await updatePhase.mutateAsync({
      id: editingPhase.id,
      name: editName.trim(),
      color: editColor,
    });
    setEditingPhase(null);
  };

  const openEdit = (phase: TaskPhaseResponse) => {
    setEditingPhase(phase);
    setEditName(phase.name);
    setEditColor(phase.color);
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
            <Settings size={20} className="text-primary-strong" />
            <h2 className="m-0 text-[18px] font-bold text-foreground">Gerenciar Fases</h2>
          </div>
          <button onClick={onClose} className="cursor-pointer border-none bg-transparent text-muted-foreground hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="mb-5 text-[13px] text-muted-foreground">
            As 3 fases padrão são fixas (A Fazer, Em Andamento, Concluído). Você pode renomear e alterar a cor de cada uma.
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
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border px-4 py-3 transition-all',
                    editingPhase?.id === phase.id ? 'bg-muted' : 'bg-card'
                  )}
                >
                  <div className="size-6 shrink-0 rounded-full" style={{ background: phase.color }} />
                  <span className="flex-1 text-[14px] font-semibold text-foreground">{phase.name}</span>
                  {phase.is_done && (
                    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-500">
                      Conclusão
                    </span>
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(phase)}
                      className="cursor-pointer border-none bg-transparent p-1 text-muted-foreground hover:text-foreground"
                      title="Renomear / alterar cor"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editingPhase ? (
            <div className="mb-4 rounded-lg border border-border bg-muted p-4">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && editName.trim()) {
                    e.preventDefault();
                    handleUpdate();
                  }
                }}
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
                      onClick={() => setEditColor(color)}
                      className="size-7 cursor-pointer rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        background: color,
                        borderColor: editColor === color ? '#fff' : 'transparent',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingPhase(null)}
                  className="rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] font-semibold text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdate}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  disabled={!editName.trim() || updatePhase.isPending}
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};