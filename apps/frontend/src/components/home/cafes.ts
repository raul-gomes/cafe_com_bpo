/** Cafés schedule: date rules and the channels where the meeting link is announced. */
import type { CafeIconName } from '../../brand/CafeIcon';

/** Meetings always start at 2 pm (Brasília time). */
export const CAFE_TIME = '14h';

/**
 * Next open café: the last Wednesday of the month. When this month's one has
 * already passed (today still counts), returns next month's.
 *
 * @param today Reference date.
 * @returns The date of the next open café.
 */
export function nextOpenCafe(today: Date): Date {
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  for (let offset = 0; offset < 3; offset++) {
    const candidate = lastWednesday(today.getFullYear(), today.getMonth() + offset);
    if (candidate >= startOfDay) return candidate;
  }
  return lastWednesday(today.getFullYear(), today.getMonth() + 1);
}

/**
 * Last Wednesday of a month (month overflow rolls into the next year).
 *
 * @param year Full year.
 * @param month Zero-based month; may exceed 11.
 * @returns The date.
 */
function lastWednesday(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0); // day 0 of the next month = last day of this one
  const back = (lastDay.getDay() - 3 + 7) % 7; // 3 = Wednesday
  return new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() - back);
}

export interface CafeChannel {
  name: string;
  description: string;
  url: string;
  icon: CafeIconName;
}

/** Channels that announce the open café link (copy shown on the page stays pt-BR). */
export const CAFE_CHANNELS: CafeChannel[] = [
  {
    name: 'Canal no WhatsApp',
    description: 'Avisos e o link de cada encontro.',
    url: 'https://whatsapp.com/channel/0029Va95EV54Y9lnz81xJH24',
    icon: 'mensagem',
  },
  {
    name: 'Comunidade no YouTube',
    description: 'Gravações, materiais e o link dos encontros.',
    url: 'https://www.youtube.com/@cafecombpo/community',
    icon: 'encontro',
  },
  {
    name: 'Página no LinkedIn',
    description: 'Novidades do movimento e o link dos encontros.',
    url: 'https://www.linkedin.com/showcase/caf%C3%A9-com-bpo/about/',
    icon: 'pessoas',
  },
];
