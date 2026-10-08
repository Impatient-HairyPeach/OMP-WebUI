/**
 * palettes — two built-in palettes (pi-web's light/dark) plus `auto` and a
 * `custom` mode that keeps one of them and overrides the accent. Applied as
 * `data-theme` on <html>; the token values themselves live in `src/index.css`.
 */
import type { ThemeOption } from '../types';

export type PaletteId = 'light' | 'dark';
export type PalettePreference = PaletteId | 'auto' | 'custom';

export const PALETTE_STORAGE_KEY = 'omp_palette';
export const CUSTOM_BASE_STORAGE_KEY = 'omp_palette_base';

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
  },
];

export function paletteById(id: PaletteId): PaletteDef {
  return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

export function loadCustomBase(): PaletteId {
  if (typeof window === 'undefined') return 'dark';
  try {
    return window.localStorage.getItem(CUSTOM_BASE_STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveCustomBase(base: PaletteId): void {
  try {
    window.localStorage.setItem(CUSTOM_BASE_STORAGE_KEY, base);
  } catch {
    // storage unavailable
  }
}

/** `auto` follows the OS; `custom` keeps the saved base; anything else is explicit. */
export function resolvePalette(preference: PalettePreference): PaletteId {
  if (preference === 'light' || preference === 'dark') return preference;
  if (preference === 'custom') return loadCustomBase();
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function loadPalettePreference(): PalettePreference {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored === 'auto' || stored === 'custom' || stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage unavailable — the dark palette is the default
  }
  return 'dark';
}

/** The ThemeOption shape the components already read (`theme.background`, …). */
export function paletteToThemeOption(id: PaletteId, accentOverride?: string | null): ThemeOption {
  const palette = paletteById(id);
  return {
    id: palette.id,
    name: palette.label.zh,
    category: palette.mode === 'dark' ? 'Dark' : 'Light',
    description: '',
    accent: accentOverride || palette.accent,
    secondary: accentOverride || palette.accent,
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
