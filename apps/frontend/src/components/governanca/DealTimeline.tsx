import React from 'react';
import { TimelineEvent } from '../../api/governanca';
import { cn } from '../../lib/utils';

interface DealTimelineProps {
  events: TimelineEvent[];
}

const EVENT_META: Record<
  string,
  { dot: string; ring: string; icon: React.ReactNode }
> = {
  created: {
    dot: 'bg-muted-foreground/40',
    ring: 'bg-muted',
    icon: (
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" />
      </svg>
    ),
  },
  sent: {
    dot: 'bg-primary',
    ring: 'bg-primary/10 text-primary-strong',
    icon: (
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" />
      </svg>
    ),
  },
  approved: {
    dot: 'bg-emerald-500',
    ring: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    icon: (
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
      </svg>
    ),
  },
  rejected: {
    dot: 'bg-red-500',
    ring: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    icon: (
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  changes: {
    dot: 'bg-sky-500',
    ring: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    icon: (
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  pending: {
    dot: 'bg-amber-500',
    ring: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    icon: (
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
      </svg>
    ),
  },
};

const formatDate = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return (
    date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  );
};

export const DealTimeline: React.FC<DealTimelineProps> = ({ events }) => {
  if (!events.length) return null;

  return (
    <ol className="relative flex items-start gap-2 overflow-x-auto pb-1" data-testid="deal-timeline">
      <span aria-hidden className="absolute left-0 right-0 top-3 h-px bg-border" />
      {events.map((event, index) => {
        const meta = EVENT_META[event.type] || EVENT_META.created;
        return (
          <li
            key={`${event.type}-${index}`}
            className="flex min-w-[150px] flex-1 flex-col items-center gap-2 px-3 text-center"
          >
            <span className={cn('z-10 flex size-6 shrink-0 items-center justify-center rounded-full', meta.ring)}>
              {meta.icon}
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-[13px] font-medium leading-snug text-foreground">{event.label}</p>
              <p className="text-[12px] text-muted-foreground">
                {event.date ? formatDate(event.date) : event.mock ? 'Aguardando decisão do prospecto' : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};