/**
 * Atmosferas do kit Café com BPO V4: família de cor × luminosidade.
 *
 * O kit lê `data-cafe-palette` e `data-cafe-mode` no <html> (cafe-themes.css).
 * A preferência fica no navegador por enquanto (mesma chave lida pelo script
 * inline de index.html, que aplica o tema antes da primeira pintura); salvar no
 * perfil do usuário é um passo posterior.
 */
import { useSyncExternalStore } from 'react';

export const PALETTES = ['cafe', 'verde', 'azul'] as const;
export const MODES = ['light', 'dark'] as const;

export type Palette = (typeof PALETTES)[number];
export type Mode = (typeof MODES)[number];
export interface Appearance {
  palette: Palette;
  mode: Mode;
}

export const PALETTE_LABELS: Record<Palette, string> = {
  cafe: 'Café',
  verde: 'Verde',
  azul: 'Azul',
};

export const MODE_LABELS: Record<Mode, string> = {
  light: 'Claro',
  dark: 'Escuro',
};

const STORAGE_KEY = 'cafe-appearance';
const DEFAULT: Appearance = { palette: 'cafe', mode: 'light' };

function isPalette(value: unknown): value is Palette {
  return typeof value === 'string' && (PALETTES as readonly string[]).includes(value);
}

function isMode(value: unknown): value is Mode {
  return typeof value === 'string' && (MODES as readonly string[]).includes(value);
}

function read(): Appearance {
  const root = document.documentElement;
  return {
    palette: isPalette(root.dataset.cafePalette) ? root.dataset.cafePalette : DEFAULT.palette,
    mode: isMode(root.dataset.cafeMode) ? root.dataset.cafeMode : DEFAULT.mode,
  };
}

let current: Appearance = read();
const listeners = new Set<() => void>();

export function getAppearance(): Appearance {
  return current;
}

export function setAppearance(next: Partial<Appearance>): void {
  current = {
    palette: isPalette(next.palette) ? next.palette : current.palette,
    mode: isMode(next.mode) ? next.mode : current.mode,
  };
  const root = document.documentElement;
  root.dataset.cafePalette = current.palette;
  root.dataset.cafeMode = current.mode;
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

/** Atmosfera atual e o setter; re-renderiza quando qualquer tela troca o tema. */
export function useAppearance(): [Appearance, (next: Partial<Appearance>) => void] {
  const value = useSyncExternalStore(subscribe, getAppearance, getAppearance);
  return [value, setAppearance];
}

/** Logo transparente conforme o contraste do fundo (manual: colorida no claro, branca no escuro). */
export function logoFor(mode: Mode): string {
  return mode === 'dark' ? '/brand/kit-v4/logo-cafe-branca.svg' : '/brand/kit-v4/logo-cafe-colorida.svg';
}
