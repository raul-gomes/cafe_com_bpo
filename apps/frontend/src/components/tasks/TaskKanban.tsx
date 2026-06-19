import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { TaskResponse, TaskPhaseResponse } from '../../schemas/tasks';
import { TaskCard } from './TaskCard';
import { cn } from '../../lib/utils';

type Props = {
  tasks: TaskResponse[];
  phases: TaskPhaseResponse[];
  clients: any[];
  onEdit: (t: TaskResponse) => void;
  getTaskStatus: (t: TaskResponse) => string;
  onFinalize?: (id: string) => void;
  onCancel?: (id: string) => void;
  columnSearch: Record<string, string>;
  setColumnSearch: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleBulkComplete: (colId: string) => void;
  handleBulkCancel: (colId: string) => void;
  bulkLoading: Record<string, 'completing' | 'cancelling' | null>;
};

const isTaskOverdueFn = (task: TaskResponse, doneColumnId: string, getTaskStatus: (t: TaskResponse) => string): boolean => {
  if (!task.deadline) return false;
  if (getTaskStatus(task) === doneColumnId) return false;
  const deadline = new Date(task.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline < today;
};

const getOverdueDaysFn = (task: TaskResponse): number => {
  if (!task.deadline) return 0;
  const deadline = new Date(task.deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
};

const sortTasksByUrgency = (tasksToSort: TaskResponse[], doneColumnId: string, getTaskStatus: (t: TaskResponse) => string): TaskResponse[] => {
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...tasksToSort].sort((a, b) => {
    const aOver = isTaskOverdueFn(a, doneColumnId, getTaskStatus);
    const bOver = isTaskOverdueFn(b, doneColumnId, getTaskStatus);
    if (aOver !== bOver) return aOver ? -1 : 1;
    const aPrio = priorityOrder[a.priority] ?? 1;
    const bPrio = priorityOrder[b.priority] ?? 1;
    if (aPrio !== bPrio) return aPrio - bPrio;
    if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });
};

const TaskKanbanInner: React.FC<Props> = ({
  tasks, phases, clients, onEdit, getTaskStatus, onFinalize, onCancel,
  columnSearch, setColumnSearch, handleBulkComplete, handleBulkCancel, bulkLoading,
}) => {
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const columns = sortedPhases.length > 0
    ? sortedPhases.map(p => ({ id: p.id, title: p.name, color: p.color }))
    : [
        { id: 'todo', title: 'A Fazer', color: '#6b7280' },
        { id: 'doing', title: 'Em Andamento', color: '#3b82f6' },
        { id: 'done', title: 'Concluído', color: '#22c55e' },
      ];

  const doneColumnId = sortedPhases.length > 0
    ? sortedPhases.reduce((prev, curr) => prev.order > curr.order ? prev : curr).id
    : 'done';

  const getClient = (id: string) => clients.find((c: any) => c.id === id);

  // Create single-arg wrappers for TaskCard props
  const isTaskOverdueWrapper = (task: TaskResponse): boolean => isTaskOverdueFn(task, doneColumnId, getTaskStatus);

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(280px, 1fr))` } as React.CSSProperties}>
      {columns.map(col => (
        <Droppable key={col.id} droppableId={col.id}>
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={cn(
                'kanban-column flex min-h-[calc(100vh-250px)] max-h-[calc(100vh-200px)] flex-col overflow-y-auto rounded-lg border border-border bg-card p-4 transition-colors',
                snapshot.isDraggingOver && 'bg-white/[0.04]'
              )}
            >
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  <span className="size-2.5 rounded-full" style={{ background: col.color }} />
                  {col.title}
                </h3>
                <div className="flex items-center gap-1">
                  {tasks.filter(t => getTaskStatus(t) === col.id).length > 0 && (
                    <>
                      <button
                        onClick={() => handleBulkComplete(col.id)}
                        disabled={bulkLoading[col.id] === 'completing'}
                        title="Concluir todos"
                        className={cn(
                          'cursor-pointer rounded-sm border px-1.5 py-0.5 text-[10px] font-bold font-sans leading-none transition-all',
                          bulkLoading[col.id] === 'completing'
                            ? 'border-white/10 bg-muted text-muted-foreground'
                            : 'border-green-500/20 bg-green-500/15 text-green-500'
                        )}
                      >
                        {bulkLoading[col.id] === 'completing' ? '...' : '✓'}
                      </button>
                      <button
                        onClick={() => handleBulkCancel(col.id)}
                        disabled={bulkLoading[col.id] === 'cancelling'}
                        title="Cancelar todos"
                        className={cn(
                          'cursor-pointer rounded-sm border px-1.5 py-0.5 text-[10px] font-bold font-sans leading-none transition-all',
                          bulkLoading[col.id] === 'cancelling'
                            ? 'border-white/10 bg-muted text-muted-foreground'
                            : 'border-red-500/20 bg-red-500/15 text-red-500'
                        )}
                      >
                        {bulkLoading[col.id] === 'cancelling' ? '...' : '✕'}
                      </button>
                    </>
                  )}
                  <span className={cn(
                    'rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground',
                    tasks.filter(t => getTaskStatus(t) === col.id).length > 0 && 'ml-2'
                  )}>
                    {tasks.filter(t => getTaskStatus(t) === col.id).length}
                  </span>
                </div>
              </div>

              {/* Column search */}
              <div className="mb-3">
                <input
                  type="text"
                  value={columnSearch[col.id] || ''}
                  onChange={e => setColumnSearch(prev => ({ ...prev, [col.id]: e.target.value }))}
                  placeholder="Filtrar cards..."
                  className="w-full rounded-sm border border-border bg-muted px-2.5 py-1.5 text-[12px] text-foreground outline-none transition-colors focus:border-primary"
                />
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-3">
                {sortTasksByUrgency(
                  tasks.filter(t => getTaskStatus(t) === col.id).filter(t => {
                    const q = (columnSearch[col.id] || '').toLowerCase();
                    if (!q) return true;
                    return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
                  }),
                  doneColumnId,
                  getTaskStatus,
                ).map((task, index) => {
                  const client = getClient(task.client_id);
                  return (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <TaskCard
                          task={task}
                          client={client}
                          colColor={col.color}
                          doneColumnId={doneColumnId}
                          onEdit={onEdit}
                          onFinalize={onFinalize}
                          onCancel={onCancel}
                          getTaskStatus={getTaskStatus}
                          isTaskOverdue={isTaskOverdueWrapper}
                          getOverdueDays={getOverdueDaysFn}
                          innerRef={provided.innerRef}
                          draggableProps={provided.draggableProps}
                          dragHandleProps={provided.dragHandleProps}
                          isDragging={snapshot.isDragging}
                          style={provided.draggableProps.style as React.CSSProperties}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      ))}
    </div>
  );
};

export const TaskKanban = React.memo(TaskKanbanInner);
