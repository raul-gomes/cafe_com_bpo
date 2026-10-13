import { useQuery } from '@tanstack/react-query';

import { getPublicSite } from '../../api/platform';
import { nextOpenCafe } from './cafes';

const BRASILIA = 'America/Sao_Paulo';

export interface NextCafe {
  /** Start of the meeting (an instant; shown in Brasília time). */
  startsAt: Date;
  /** Meeting title set in Admin. */
  title: string;
}

/**
 * Default rule while the API has not answered: last Wednesday, 14h Brasília.
 *
 * @param now Reference instant.
 * @returns The start of the next open café by the default rule.
 */
export function defaultNextCafeStart(now: Date = new Date()): Date {
  const day = nextOpenCafe(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return new Date(`${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T14:00:00-03:00`);
}

/**
 * Next open café as the whole public site must show it: the meeting set in
 * Admin (`/site/public`), which the backend already advances once a meeting
 * ends. Banner, cards and the RSVP strip read this one source, so they never
 * disagree (AUD-037).
 *
 * @returns The next meeting (default rule until the API answers).
 */
export function useNextCafe(): NextCafe {
  const { data: site } = useQuery({ queryKey: ['public-site'], queryFn: getPublicSite, staleTime: 5 * 60_000 });
  return {
    startsAt: site ? new Date(site.cafe_meeting.starts_at) : defaultNextCafeStart(),
    title: site?.cafe_meeting.title ?? 'Café aberto do Café com BPO',
  };
}

/**
 * "quarta-feira, 21 de outubro, às 15h30" (or "às 14h" on the hour), always in
 * Brasília time, whatever the visitor's time zone.
 *
 * @param startsAt Meeting start.
 * @returns The day and time, in pt-BR.
 */
export function formatCafeDayAndTime(startsAt: Date): string {
  const day = startsAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: BRASILIA,
  });
  const [hour, minute] = startsAt
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: BRASILIA })
    .split(':');
  const time = minute === '00' ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
  return `${day}, às ${time}`;
}
