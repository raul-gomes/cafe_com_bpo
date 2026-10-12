import { useEffect } from 'react';
import type React from 'react';

/**
 * Sheet over sheet: every `.hb-sheet` section sticks to the top and the next
 * one slides over it, like a sheet of paper laid on another. A section taller
 * than the screen first scrolls to its end and only then sticks (negative
 * top), so nothing is hidden. Desktop only, and off with "reduce motion".
 *
 * @param root Element that contains the sheets.
 */
export function useStackedSheets(root: React.RefObject<HTMLElement>): void {
  useEffect(() => {
    const page = root.current;
    const desktop = window.matchMedia?.('(min-width: 900px)');
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!page || !desktop || !reduceMotion) return;

    const sheets = () => Array.from(page.querySelectorAll<HTMLElement>('.hb-sheet'));
    const adjust = () => {
      const enabled = desktop.matches && !reduceMotion.matches;
      page.classList.toggle('hb-sheets-on', enabled);
      const headerHeight = document.querySelector<HTMLElement>('.pub-nav')?.offsetHeight ?? 0;
      sheets().forEach((sheet, index) => {
        sheet.style.zIndex = enabled ? String(index + 1) : '';
        sheet.style.top = enabled ? `${Math.min(headerHeight, window.innerHeight - sheet.offsetHeight)}px` : '';
      });
    };

    adjust();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(adjust) : null;
    sheets().forEach(sheet => observer?.observe(sheet));
    window.addEventListener('resize', adjust);
    desktop.addEventListener?.('change', adjust);
    reduceMotion.addEventListener?.('change', adjust);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', adjust);
      desktop.removeEventListener?.('change', adjust);
      reduceMotion.removeEventListener?.('change', adjust);
    };
  }, [root]);
}
