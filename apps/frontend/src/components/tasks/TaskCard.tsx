import React, { useCallback } from 'react';
import { Calendar as CalendarIcon, AlertTriangle, XCircle, Check, Clock } from 'lucide-react';
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
  const isDone = status === doneColumnId;
  const isCancelled = task.status === 'cancelled' || task.cancelled_at;

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

  const priorityLabel =
    task.priority === 'high' ? 'Alta'
      : task.priority === 'medium' ? 'Média'
        : 'Baixa';

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
        'flex cursor-pointer flex-col rounded-lg border border-border/40 p-3 transition-all gap-1.5',
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
      {/* Top row: Client name + Template badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
          {client?.name || 'Cliente'}
        </span>
        {task.template_name && (
          <span className="inline-block rounded-md bg-card px-1.5 py-0.5 text-[9px] font-bold text-foreground shadow-sm">
            {task.template_name}
          </span>
        )}
      </div>

      {/* Title — main emphasis */}
      <div className="text-[15px] font-bold leading-[1.3] text-foreground">
        {task.title}
      </div>

      {/* Description (clamped to 1 line) */}
      {task.description && (
        <div className="overflow-hidden text-ellipsis whitespace-pre-wrap text-[12px] leading-[1.3] text-muted-foreground line-clamp-1">
          {task.description}
        </div>
      )}

      {/* Due date + Overdue badge — prominent */}
      {task.deadline && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <CalendarIcon size={14} className="text-muted-foreground" />
            {new Date(task.deadline).toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </div>
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
              <AlertTriangle size={12} /> Atrasado {getOverdueDays(task)}d
            </span>
          )}
        </div>
      )}

      {/* Overdue without deadline (fallback) */}
      {!task.deadline && overdue && (
        <div className="flex items-center">
          <span className="inline-flex items-center gap-1 rounded-sm bg-destructive/15 px-2 py-0.5 text-[11px] font-bold text-destructive">
            <AlertTriangle size={12} /> Atrasado {getOverdueDays(task)}d
          </span>
        </div>
      )}

      {/* Bottom row: metadata + action buttons */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {task.time_estimate_minutes && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> {task.time_estimate_minutes}min
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: priorityColor }} />
            {priorityLabel}
          </span>
          <span>
            {new Date(task.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit',
            })}
          </span>
        </div>
        <div className="flex gap-1">
          {onFinalize && !isDone && !isCancelled && (
            <button
              onClick={(e) => { e.stopPropagation(); onFinalize(task.id); }}
              className="flex size-5 items-center justify-center rounded-sm border-none text-green-500 transition-all hover:brightness-110"
              style={{ background: 'rgba(34,197,94,0.12)' }}
              title="Mover para Concluído"
              aria-label="Finalizar tarefa"
            >
              <Check size={11} />
            </button>
          )}
          {onCancel && !isDone && !isCancelled && (
            <button
              onClick={(e) => { e.stopPropagation(); handleCancel(); }}
              className="flex size-5 items-center justify-center rounded-sm border-none text-red-500 transition-all hover:brightness-110"
              style={{ background: 'rgba(239,68,68,0.12)' }}
              title="Cancelar tarefa"
              aria-label="Cancelar tarefa"
            >
              <XCircle size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
