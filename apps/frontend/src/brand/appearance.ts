/**
 * Panel appearance: light (default) or dark, always in the Café family of the V4 kit.
 *
 * The kit has three color families (café, verde, azul); we tried the six
 * atmospheres and Ghuto decided on 2026-10-11 to simplify: with the module
 * colors on top, the other families became noise. Only the lightness remains
 * (`data-cafe-mode` on <html>); `data-cafe-palette` is pinned to "cafe"
 * (index.html).
 *
 * The preference lives in the browser (same key read by the inline script of
 * index.html, which applies the mode before the first paint).
 */
import { useSyncExternalStore } from 'react';

export const MODES = ['light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

/** Mode names as the UI shows them. */
export const MODE_LABELS: Record<Mode, string> = {
  light: 'Claro',
  dark: 'Escuro',
};

export interface Appearance {
  mode: Mode;
}

const STORAGE_KEY = 'cafe-appearance';
const DEFAULT_MODE: Mode = 'light';

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

let current: Appearance = {
  mode: isMode(document.documentElement.dataset.cafeMode) ? document.documentElement.dataset.cafeMode : DEFAULT_MODE,
};
const listeners = new Set<() => void>();

/**
 * Current appearance.
 *
 * @returns The appearance in use.
 */
export function getAppearance(): Appearance {
  return current;
}

/**
 * Changes the appearance, applies it to <html> and remembers it.
 *
 * @param next Fields to change.
 */
export function setAppearance(next: Partial<Appearance>): void {
  current = { mode: isMode(next.mode) ? next.mode : current.mode };
  document.documentElement.dataset.cafePalette = 'cafe';
  document.documentElement.dataset.cafeMode = current.mode;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // storage unavailable (private window): applies to this session only
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Current appearance and its setter; re-renders when any screen changes the mode.
 *
 * @returns A tuple of the appearance and the setter.
 */
export function useAppearance(): [Appearance, (next: Partial<Appearance>) => void] {
  const value = useSyncExternalStore(subscribe, getAppearance, getAppearance);
  return [value, setAppearance];
}

/**
 * Transparent logo matching the background contrast (brand manual: colored on
 * light, white on dark).
 *
 * @param mode Current mode.
 * @returns The logo URL.
 */
export function logoFor(mode: Mode): string {
  return mode === 'dark' ? '/brand/kit-v4/logo-cafe-branca.svg' : '/brand/kit-v4/logo-cafe-colorida.svg';
}
