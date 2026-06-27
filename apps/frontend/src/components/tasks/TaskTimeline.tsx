import React from 'react';
import { TaskResponse } from '../../schemas/tasks';
import { cn } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

type TimelineTaskItem = { id: string; title: string; client_id: string; deadline?: string; time_estimate_minutes?: number; priority: string; process_type?: string; status: string };
type ConflictTaskItem = { id: string; title: string; time_estimate_minutes?: number; deadline?: string };

type Props = {
  timeline: { date: string; tasks: TimelineTaskItem[]; total_minutes: number }[];
  conflicts: { date: string; tasks: ConflictTaskItem[]; total_hours: number }[];
  clients: any[];
  isLoading: boolean;
  onEdit: (t: TaskResponse) => void;
};

const TaskTimelineInner: React.FC<Props> = ({ timeline, conflicts, clients, isLoading, onEdit }) => {
  const getClient = (id: string) => clients.find((c: any) => c.id === id);
  const conflictDates = new Set(conflicts.map(c => c.date));

  if (isLoading) return <div className="py-10 text-center text-muted-foreground">Carregando timeline...</div>;
  if (timeline.length === 0) return <div className="py-10 text-center text-muted-foreground">Nenhuma tarefa com prazo encontrada.</div>;

  const maxMinutes = Math.max(...timeline.map(d => d.total_minutes), 480);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-foreground">Timeline de Tarefas</h2>
        {conflicts.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-3 py-1.5 text-[12px] text-warning">
            <AlertTriangle size={14} /> {conflicts.length} conflito(s) de sobrecarga detectado(s)
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {timeline.map(day => {
          const isPast = new Date(day.date + 'T00:00:00') < new Date(new Date().toISOString().split('T')[0]);
          const isConflict = conflictDates.has(day.date);
          return (
            <div
              key={day.date}
              className={cn(
                'rounded-lg border p-4',
                isConflict
                  ? 'border-warning/30 bg-warning/5'
                  : 'border-white/[0.06] bg-muted',
                isPast && 'opacity-60'
              )}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[13px] font-bold text-foreground">
                  {new Date(day.date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-[100px] overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((day.total_minutes / maxMinutes) * 100, 100)}%`,
                        background: day.total_minutes > 480 ? 'var(--ds-error)' : 'var(--ds-primary)',
                      }}
                    />
                  </div>
                  <span className={cn('text-[11px] font-bold', day.total_minutes > 480 ? 'text-destructive' : 'text-muted-foreground')}>
                    {(day.total_minutes / 60).toFixed(1)}h
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {day.tasks.map(task => {
                  const client = getClient(task.client_id);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onEdit(task as TaskResponse)}
                      className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] text-foreground transition-colors hover:brightness-110"
                      style={{
                        background: (client?.color || 'var(--ds-primary)') + '22',
                        borderLeft: `3px solid ${client?.color || 'var(--ds-primary)'}`,
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: client?.color || 'var(--ds-text-muted)' }}>
                        {client?.name || 'Cliente'}
                      </span>
                      <span className="font-semibold">{task.title}</span>
                      {task.status === 'doing' && (
                        <span className="rounded-sm bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                          Em andamento
                        </span>
                      )}
                      {task.time_estimate_minutes && (
                        <span className="text-[10px] font-bold text-muted-foreground">{task.time_estimate_minutes}min</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TaskTimeline = React.memo(TaskTimelineInner);
