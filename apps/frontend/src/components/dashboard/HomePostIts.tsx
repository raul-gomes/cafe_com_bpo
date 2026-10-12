import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listActiveAnnouncements } from '../../api/platform';

const DISMISSED_KEY = 'cafe_dismissed_post_its';

/** Ids of post-its this person already put away (per browser, a convenience). */
function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Post-its on the home panel: messages the team sent with "show on home".
 * Each person can put one away ("Ok, vi"); it stays in the bell.
 *
 * @returns The post-its, or nothing when there are none.
 */
export const HomePostIts: React.FC = () => {
  const { data: announcements } = useQuery({ queryKey: ['announcements', 'active'], queryFn: listActiveAnnouncements });
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);

  const visible = (announcements ?? []).filter(item => !dismissed.includes(item.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next.slice(-50)));
    } catch {
      /* storage unavailable: hidden only until the next visit */
    }
  };

  return (
    <section className="home-post-its" aria-label="Recados da equipe do Café">
      {visible.map(item => (
        <article key={item.id} className="home-post-it">
          <h3>{item.title}</h3>
          <p>{item.message}</p>
          <div className="home-post-it-meta">
            <span>Equipe Café · {new Date(item.created_at).toLocaleDateString('pt-BR')}</span>
            <button type="button" className="home-post-it-close" onClick={() => dismiss(item.id)}>
              Ok, vi
            </button>
          </div>
        </article>
      ))}
    </section>
  );
};
