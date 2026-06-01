import React from 'react';
import { Calendar as CalendarIcon, AlertTriangle, XCircle, Check } from 'lucide-react';
import { TaskResponse } from '../../schemas/tasks';

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
  /** Ref from Draggable provided.innerRef */
  innerRef?: React.Ref<HTMLDivElement>;
  /** Spread props from Draggable provided.draggableProps */
  draggableProps?: Record<string, any>;
  /** Spread props from Draggable provided.dragHandleProps */
  dragHandleProps?: Record<string, any> | null;
  /** Whether this card is currently being dragged */
  isDragging?: boolean;
  /** Extra style from Draggable provided.draggableProps.style */
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

  return (
    <div
      ref={innerRef}
      {...(draggableProps || {})}
      {...(dragHandleProps || {})}
      className={`task-card ds-card ${overdue ? 'task-card--overdue' : ''}`}
      onClick={() => onEdit(task)}
      style={{
        ...(style || {}),
        padding: '16px',
        borderLeft: `4px solid ${client?.color || colColor}`,
        cursor: 'pointer',
        backgroundColor: isDragging ? 'var(--ds-surface-3)' : 'var(--ds-surface-2)',
        zIndex: isDragging ? 999 : 1,
        transform: isDragging
          ? `${style?.transform || ''} rotate(2deg) scale(1.02)`
          : style?.transform,
      }}
    >
      {/* Line 1: Client name + Priority dot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 900,
            color: client?.color || colColor,
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {client?.name || 'Cliente'}
        </div>
        {/* Template badge */}
        {task.template_name && (
          <div
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: 'var(--ds-primary)',
              background: 'rgba(59, 130, 246, 0.1)',
              padding: '2px 6px',
              borderRadius: '4px',
              marginBottom: '4px',
              display: 'inline-block',
            }}
          >
            {task.template_name}
          </div>
        )}
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background:
              task.priority === 'high'
                ? 'var(--ds-error)'
                : task.priority === 'medium'
                  ? 'var(--ds-warning)'
                  : 'var(--ds-success)',
          }}
        />
      </div>

      {/* Line 2: Title + Action buttons on same row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: '14px',
            lineHeight: 1.4,
            color: 'var(--ds-text)',
            flex: 1,
            minWidth: 0,
          }}
        >
          {task.title}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {onFinalize && status !== doneColumnId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFinalize(task.id);
              }}
              style={{
                width: '36px',
                height: '36px',
                background: 'rgba(34,197,94,0.12)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: '#22c55e',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              className="finalize-btn"
              title="Mover para Concluído"
              aria-label="Finalizar tarefa"
            >
              <Check size={18} />
            </button>
          )}
          {onCancel &&
            status !== doneColumnId &&
            task.status !== 'cancelled' &&
            !task.cancelled_at && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Tem certeza que deseja cancelar "${task.title}"?`)) {
                    onCancel(task.id);
                  }
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(239,68,68,0.12)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                className="cancel-btn"
                title="Cancelar tarefa"
                aria-label="Cancelar tarefa"
              >
                <XCircle size={18} />
              </button>
            )}
        </div>
      </div>

      {/* Line 3: Overdue badge + Deadline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {overdue && (
            <span className="overdue-badge">
              <AlertTriangle size={10} /> Atrasado {getOverdueDays(task)}d
            </span>
          )}
        </div>
        {task.deadline && (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--ds-text-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <CalendarIcon size={12} />{' '}
            {new Date(task.deadline).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })}
          </div>
        )}
      </div>

      {/* Line 4: Creation / Completion metadata */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '8px',
          fontSize: '10px',
          color: 'var(--ds-text-muted)',
          opacity: 0.7,
        }}
      >
        <span>
          Criada em{' '}
          {new Date(task.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          })}
        </span>
        {status === doneColumnId && (
          <span>
            Finalizada em{' '}
            {new Date(task.updated_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
            })}
          </span>
        )}
      </div>
    </div>
  );
};
