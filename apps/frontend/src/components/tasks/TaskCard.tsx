import React, { useCallback } from 'react';
import { Calendar as CalendarIcon, AlertTriangle, XCircle, Check } from 'lucide-react';
import { TaskResponse } from '../../schemas/tasks';
import { useConfirm } from '../ui/ConfirmDialog';
import { cn } from '../../lib/utils';

interface TaskCardProps {
  task: TaskResponse;
  client?: { id: string; name: string; color?: string };
  colColor: string;
  doneColumnId: string;
  onEdit: (task: TaskResponse) => void;
  onFinalize?: (id: string) => void;
  onCancel?: (id: string) => void;
  getTaskStatus: (task: TaskResponse) => string;
  isTaskOverdue: (task: TaskResponse) => boolean;
  getOverdueDays: (task: TaskResponse) => number;
  innerRef?: React.Ref<HTMLDivElement>;
  draggableProps?: Record<string, any>;
  dragHandleProps?: Record<string, any> | null;
  isDragging?: boolean;
  style?: React.CSSProperties;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  client,
  colColor,
  doneColumnId,
  onEdit,
  onFinalize,
  onCancel,
  getTaskStatus,
  isTaskOverdue,
  getOverdueDays,
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
  style,
}) => {
  const status = getTaskStatus(task);
  const overdue = isTaskOverdue(task);
  const confirm = useConfirm();

  const handleCancel = useCallback(async () => {
    if (!onCancel) return;
    const ok = await confirm({
      title: 'Cancelar tarefa',
      message: `Tem certeza que deseja cancelar "${task.title}"?`,
      variant: 'warning',
      confirmLabel: 'Sim, cancelar',
    });
    if (ok) {
      onCancel(task.id);
    }
  }, [onCancel, task.id, task.title, confirm]);

  const priorityColor =
    task.priority === 'high'
      ? 'var(--ds-error)'
      : task.priority === 'medium'
        ? 'var(--ds-warning)'
        : 'var(--ds-success)';

  return (
    <div
      ref={innerRef}
      {...(draggableProps || {})}
      {...(dragHandleProps || {})}
      className={cn(
        'flex cursor-pointer flex-col rounded-lg border border-border/40 p-4 transition-all',
        overdue && 'border-warning/30',
        isDragging
          ? 'z-[999] bg-card shadow-2xl'
          : 'z-[1] bg-muted hover:border-border/80'
      )}
      onClick={() => onEdit(task)}
      style={{
        ...(style || {}),
        borderLeft: `4px solid ${client?.color || colColor}`,
        transform: isDragging
          ? `${style?.transform || ''} rotate(2deg) scale(1.02)`
          : style?.transform,
      }}
    >
      {/* Line 1: Client name + Template badge + Priority dot */}
      <div className="mb-1.5 flex items-start justify-between">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {client?.name || 'Cliente'}
        </div>
        <div className="flex items-center gap-2">
          {task.template_name && (
            <div className="inline-block rounded-md bg-card px-2 py-0.5 text-[10px] font-bold text-foreground shadow-sm">
              {task.template_name}
            </div>
          )}
          <div className="size-1.5 shrink-0 rounded-full" style={{ background: priorityColor }} />
        </div>
      </div>

      {/* Line 2: Title + Action buttons */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 text-[14px] font-semibold leading-[1.4] text-foreground">
          {task.title}
        </div>
        <div className="flex shrink-0 gap-1">
          {onFinalize && status !== doneColumnId && (
            <button
              onClick={(e) => { e.stopPropagation(); onFinalize(task.id); }}
              className="flex size-6 items-center justify-center rounded-sm border-none text-green-500 transition-all hover:brightness-110"
              style={{ background: 'rgba(34,197,94,0.12)' }}
              title="Mover para Concluído"
              aria-label="Finalizar tarefa"
            >
              <Check size={14} />
            </button>
          )}
          {onCancel && status !== doneColumnId && task.status !== 'cancelled' && !task.cancelled_at && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              className="flex size-6 items-center justify-center rounded-sm border-none text-red-500 transition-all hover:brightness-110"
              style={{ background: 'rgba(239,68,68,0.12)' }}
              title="Cancelar tarefa"
              aria-label="Cancelar tarefa"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Description (clamped to 2 lines) */}
      {task.description && (
        <div className="mb-2 overflow-hidden text-ellipsis whitespace-pre-wrap text-[12px] leading-[1.4] text-muted-foreground line-clamp-2">
          {task.description}
        </div>
      )}

      {/* Line 3: Overdue badge + Deadline */}
      <div className="flex items-center justify-between">
        <div>
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">
              <AlertTriangle size={10} /> Atrasado {getOverdueDays(task)}d
            </span>
          )}
        </div>
        {task.deadline && (
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <CalendarIcon size={14} />
            {new Date(task.deadline).toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Line 4: Creation / Completion metadata */}
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground opacity-70">
        <span>
          Criada em{' '}
          {new Date(task.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit',
          })}
        </span>
        {status === doneColumnId && (
          <span>
            Finalizada em{' '}
            {new Date(task.updated_at).toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
};
