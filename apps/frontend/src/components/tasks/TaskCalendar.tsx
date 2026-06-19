import React from 'react';
import { TaskResponse } from '../../schemas/tasks';
import { cn } from '../../lib/utils';

type Props = {
  tasks: TaskResponse[];
  clients: any[];
  onEdit: (t: TaskResponse) => void;
  isMacro?: boolean;
};

const TaskCalendarInner: React.FC<Props> = ({ tasks, clients, onEdit, isMacro }) => {
  const today = new Date();
  const currMonth = today.getMonth();
  const currYear = today.getFullYear();
  const daysInMonth = new Date(currYear, currMonth + 1, 0).getDate();
  const firstDay = new Date(currYear, currMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const getClient = (id: string) => clients.find((c: any) => c.id === id);
  const dayAbbrs = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <div>
      {!isMacro && (
        <div className="mb-6 flex justify-center">
          <h2 className="text-[18px] font-bold capitalize text-foreground">
            {today.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h2>
        </div>
      )}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md" style={{ background: 'rgba(255,255,255,0.08)' }}>
        {dayAbbrs.map((d, idx) => (
          <div key={`h-${idx}`} className={cn(
            'text-center font-extrabold uppercase text-muted-foreground',
            isMacro ? 'bg-muted p-1 text-[9px]' : 'bg-muted p-3 text-[9px]'
          )}>
            {d}
          </div>
        ))}
        {blanks.map(i => (
          <div key={`b-${i}`} className="bg-transparent" style={{ minHeight: isMacro ? '40px' : '110px' }} />
        ))}
        {days.map(day => {
          const dateStr = new Date(currYear, currMonth, day).toISOString().split('T')[0];
          const dayTasks = tasks.filter(t => t.deadline && t.deadline.startsWith(dateStr));
          const isToday = day === today.getDate();

          return (
            <div
              key={`d-${day}`}
              className="flex flex-col gap-0.5 border border-white/[0.02] bg-transparent"
              style={{ minHeight: isMacro ? '40px' : '110px', padding: isMacro ? '2px' : '8px' }}
            >
              <div className={cn(
                'mb-0.5 text-right font-extrabold',
                isMacro ? 'text-[10px]' : 'text-[12px]',
                isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
                {day}
              </div>
              {dayTasks.map(task => {
                const client = getClient(task.client_id);
                return (
                  <div
                    key={task.id}
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    title={`${client?.name || ''}: ${task.title}`}
                    className={cn(
                      'cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap',
                      isMacro
                        ? 'h-1.5 rounded-sm'
                        : 'flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-extrabold text-black'
                    )}
                    style={{
                      background: client?.color || 'var(--ds-primary)',
                      height: isMacro ? '6px' : 'auto',
                      borderLeft: !isMacro && task.priority === 'high' ? '3px solid rgba(0,0,0,0.5)' : 'none',
                    }}
                  >
                    {!isMacro && (
                      <span
                        className="inline-block size-1.5 shrink-0 rounded-full"
                        style={{
                          background: task.priority === 'high' ? 'var(--ds-error)' : task.priority === 'medium' ? 'var(--ds-warning)' : 'var(--ds-success)',
                        }}
                      />
                    )}
                    {!isMacro && task.status === 'doing' && (
                      <span className="rounded-sm bg-blue-500 px-0.5 text-[7px] font-extrabold leading-none text-white">EM AND</span>
                    )}
                    {!isMacro && task.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TaskCalendar = React.memo(TaskCalendarInner);
