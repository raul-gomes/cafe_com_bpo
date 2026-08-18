import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

  // Navegação entre meses (apenas na visão principal; a macro usa o mês atual)
  const [month, setMonth] = useState(() => ({ year: currYear, month: currMonth }));

  const viewMonth = isMacro ? currMonth : month.month;
  const viewYear = isMacro ? currYear : month.year;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const getClient = (id: string) => clients.find((c: any) => c.id === id);
  const dayAbbrs = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const phaseOrders = tasks
    .map(t => t.phase?.order)
    .filter((o): o is number => typeof o === 'number');
  const minOrder = phaseOrders.length > 0 ? Math.min(...phaseOrders) : 0;

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const isCurrentMonth = viewYear === currYear && viewMonth === currMonth;
  const isToday = (day: number) => isCurrentMonth && day === today.getDate();

  const goPrev = () => setMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 });
  const goNext = () => setMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 });

  return (
    <div>
      {!isMacro && (
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            title="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <h2 className="text-[18px] font-bold capitalize text-foreground">{monthLabel}</h2>
            {!isCurrentMonth && (
              <button
                type="button"
                onClick={() => setMonth({ year: currYear, month: currMonth })}
                className="mt-0.5 cursor-pointer border-none bg-transparent text-[11px] font-bold text-primary-strong underline underline-offset-2"
              >
                Voltar para o mês atual
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={goNext}
            className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            title="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
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
          const dateStr = new Date(viewYear, viewMonth, day).toISOString().split('T')[0];
          const dayTasks = tasks.filter(t => t.deadline && t.deadline.startsWith(dateStr));

          return (
            <div
              key={`d-${day}`}
              className="flex flex-col gap-0.5 border border-white/[0.02] bg-transparent"
              style={{ minHeight: isMacro ? '40px' : '110px', padding: isMacro ? '2px' : '8px' }}
            >
              <div className={cn(
                'mb-0.5 text-right font-extrabold',
                isMacro ? 'text-[10px]' : 'text-[12px]',
                isToday(day) ? 'text-primary-strong' : 'text-muted-foreground'
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
                    {!isMacro && task.phase && !task.phase.is_done && task.phase.order > minOrder && (
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