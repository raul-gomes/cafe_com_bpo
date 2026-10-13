import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { CafeIcon } from '../../brand/CafeIcon';
import { formatCafeDayAndTime, useNextCafe } from './useNextCafe';

/*
 * Closing the banner only lasts while the page is open: a reload brings it
 * back, and so does clicking the header logo (reopenCafeBanner).
 */
let closed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Shows the next-café banner again (used by the header logo). */
// eslint-disable-next-line react-refresh/only-export-components
export function reopenCafeBanner(): void {
  closed = false;
  notify();
}

function closeBanner(): void {
  closed = true;
  notify();
}

/**
 * Floating banner (screen corner) inviting people to the next open café.
 *
 * @returns The banner, or nothing while hidden.
 */
export const CafeBanner: React.FC = () => {
  const isClosed = useSyncExternalStore(subscribe, () => closed, () => closed);
  const { startsAt } = useNextCafe();
  const [ready, setReady] = useState(false);

  // Comes in a little after the page, so it does not compete with the hero.
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  if (!ready || isClosed) return null;

  return (
    <aside className="cafe-banner" aria-label="Próximo café">
      <button type="button" className="cafe-banner-close" onClick={closeBanner} aria-label="Fechar aviso">
        <CafeIcon name="fechar" className="size-[18px]" />
      </button>
      <span className="cafe-banner-icon" aria-hidden="true"><CafeIcon name="xicara" /></span>
      <div>
        <p className="cafe-banner-kicker">Participe do próximo café</p>
        <p className="cafe-banner-text">
          Encontro aberto no Meet: <strong>{formatCafeDayAndTime(startsAt)}</strong>.
        </p>
        <Link to="/cafes" className="cafe-banner-link">
          Ver agenda dos cafés <CafeIcon name="expandir" className="size-[16px]" />
        </Link>
      </div>
    </aside>
  );
};
