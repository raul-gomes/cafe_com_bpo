/**
 * Aparência do painel: claro (padrão) ou escuro, sempre na família Café do kit V4.
 *
 * O kit tem três famílias (café, verde, azul); testamos as seis atmosferas e
 * Ghuto decidiu em 2026-10-11 simplificar: com as cores de módulo por cima, as
 * outras famílias viraram ruído. Fica só a luminosidade (`data-cafe-mode` no
 * <html>); `data-cafe-palette` é fixado em "cafe" (index.html).
 *
 * A preferência fica no navegador (mesma chave lida pelo script inline de
 * index.html, que aplica o modo antes da primeira pintura).
 */
import { useSyncExternalStore } from 'react';

export const MODES = ['light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

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

export function getAppearance(): Appearance {
  return current;
}

export function setAppearance(next: Partial<Appearance>): void {
  current = { mode: isMode(next.mode) ? next.mode : current.mode };
  document.documentElement.dataset.cafePalette = 'cafe';
  document.documentElement.dataset.cafeMode = current.mode;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // armazenamento indisponível (aba privada): vale só nesta sessão
  }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Aparência atual e o setter; re-renderiza quando qualquer tela troca o modo. */
export function useAppearance(): [Appearance, (next: Partial<Appearance>) => void] {
  const value = useSyncExternalStore(subscribe, getAppearance, getAppearance);
  return [value, setAppearance];
}

/** Logo transparente conforme o contraste do fundo (manual: colorida no claro, branca no escuro). */
export function logoFor(mode: Mode): string {
  return mode === 'dark' ? '/brand/kit-v4/logo-cafe-branca.svg' : '/brand/kit-v4/logo-cafe-colorida.svg';
}
