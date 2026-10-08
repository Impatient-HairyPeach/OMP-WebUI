/**
 * palettes — the five palettes pi-web ships (plus `auto`), applied as
 * `data-theme` on <html>. The CSS tokens live in `src/index.css`; this module
 * only names them and mirrors their values into the ThemeOption shape the
 * existing components read inline.
 */
import type { ThemeOption } from '../types';

export type PaletteId = 'light' | 'dark' | 'mist' | 'rose' | 'pine';
export type PalettePreference = PaletteId | 'auto';

export const PALETTE_STORAGE_KEY = 'omp_palette';

interface PaletteDef {
  id: PaletteId;
  label: { en: string; zh: string };
  mode: 'dark' | 'light';
  bg: string;
  bgPanel: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  secondary: string;
}

export const PALETTES: PaletteDef[] = [
  {
    id: 'dark',
    label: { en: 'Dark', zh: '深色' },
    mode: 'dark',
    bg: '#1a1a1a',
    bgPanel: '#242424',
    border: '#454545',
    text: '#e8e8e8',
    textMuted: '#b7b7b7',
    textDim: '#a4a4a4',
    accent: '#a4c2f4',
    secondary: '#a4c2f4',
  },
  {
    id: 'light',
    label: { en: 'Light', zh: '浅色' },
    mode: 'light',
    bg: '#ffffff',
    bgPanel: '#f5f5f5',
    border: '#e0e0e0',
    text: '#1a1a1a',
    textMuted: '#515c6b',
    textDim: '#5e6673',
    accent: '#245bce',
    secondary: '#245bce',
  },
  {
    id: 'mist',
    label: { en: 'Mist', zh: '薄雾' },
    mode: 'light',
    bg: '#f4f8f7',
    bgPanel: '#e9f0ee',
    border: '#afc4ba',
    text: '#202e2b',
    textMuted: '#3f534d',
    textDim: '#566a63',
    accent: '#1e6559',
    secondary: '#1e6559',
  },
  {
    id: 'rose',
    label: { en: 'Rose', zh: '玫瑰' },
    mode: 'light',
    bg: '#fcf7f8',
    bgPanel: '#f3edef',
    border: '#cdb5bf',
    text: '#34282e',
    textMuted: '#5c4b53',
    textDim: '#6f5f66',
    accent: '#914360',
    secondary: '#914360',
  },
  {
    id: 'pine',
    label: { en: 'Pine', zh: '松林' },
    mode: 'dark',
    bg: '#19201f',
    bgPanel: '#212b28',
    border: '#4a5f52',
    text: '#e6ede8',
    textMuted: '#b6c6bd',
    textDim: '#9fb1a8',
    accent: '#acccb7',
    secondary: '#acccb7',
  },
];

export function paletteById(id: PaletteId): PaletteDef {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

/** `auto` follows the OS; anything else is explicit. */
export function resolvePalette(preference: PalettePreference): PaletteId {
  if (preference !== 'auto') return preference;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function loadPalettePreference(): PalettePreference {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored === 'auto') return 'auto';
    if (stored && PALETTES.some((palette) => palette.id === stored)) return stored as PaletteId;
  } catch {
    // storage unavailable — pi-web's dark palette is the default
  }
  return 'dark';
}

/** The ThemeOption shape the components already read (`theme.background`, …). */
export function paletteToThemeOption(id: PaletteId, accentOverride?: string | null): ThemeOption {
  const palette = paletteById(id);
  return {
    id: palette.id,
    name: palette.label.zh,
    category: palette.mode === 'dark' ? 'Dark Palettes' : 'Light Palettes',
    description: '',
    accent: accentOverride || palette.accent,
    secondary: accentOverride || palette.secondary,
    background: palette.bg,
    cardBg: palette.bgPanel,
    border: palette.border,
    tag: palette.border,
    mode: palette.mode,
    text: palette.text,
    textMuted: palette.textMuted,
  };
}

/** Font choices map onto stacks the OS already provides; nothing is downloaded. */
const SYSTEM_MONO_FONTS = new Set(['System Mono', 'Geist Mono', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono']);

/** Paint the palette on <html>: tokens change, markup does not. */
export function applyPalette(id: PaletteId, customAccent?: string | null, fontMono?: string): void {
  const root = document.documentElement;
  const palette = paletteById(id);
  root.setAttribute('data-theme', palette.id);
  root.setAttribute('data-theme-mode', palette.mode);
  root.classList.toggle('dark', palette.mode === 'dark');
  root.classList.toggle('light', palette.mode === 'light');
  if (customAccent) {
    root.style.setProperty('--accent', customAccent);
    root.style.setProperty('--accent-hover', customAccent);
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-hover');
  }
  if (!fontMono || SYSTEM_MONO_FONTS.has(fontMono)) {
    root.style.removeProperty('--font-mono');
  } else {
    root.style.setProperty('--font-mono', `'${fontMono}', ui-monospace, Consolas, monospace`);
  }
  document.body.style.backgroundColor = palette.bg;
  document.body.style.color = palette.text;
}
