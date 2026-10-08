import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeOption } from '../types';
import { THEME_OPTIONS } from '../components/views/ThemeView';
import {
  applyPalette,
  loadPalettePreference,
  paletteToThemeOption,
  resolvePalette,
  type PaletteId,
  type PalettePreference,
} from '../lib/palettes';

interface ThemeContextType {
  /** Active palette, mirrored into the shape components read inline. */
  theme: ThemeOption;
  setTheme: (theme: ThemeOption) => void;
  saveCustomTheme: (customTheme: ThemeOption) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  /** pi-web palette switch (light | dark | mist | rose | pine | auto). */
  paletteId: PalettePreference;
  setPaletteId: (id: PalettePreference) => void;
  resolvedPalette: PaletteId;
  uiDensity: 'compact' | 'standard' | 'relaxed';
  setUiDensity: (density: 'compact' | 'standard' | 'relaxed') => void;
  editorFont: string;
  setEditorFont: (font: string) => void;
  enableGrid: boolean;
  setEnableGrid: (enabled: boolean) => void;
  enableGlow: boolean;
  setEnableGlow: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [paletteId, setPaletteIdState] = useState<PalettePreference>(() => loadPalettePreference());
  const [resolvedPalette, setResolvedPalette] = useState<PaletteId>(() => resolvePalette(loadPalettePreference()));
  // A saved accent overrides the palette accent; unset means "follow the palette".
  const [accentColor, setAccentColorState] = useState<string>(() => localStorage.getItem('omp_accent_color') || '');
  const [uiDensity, setUiDensityState] = useState<'compact' | 'standard' | 'relaxed'>(
    () => (localStorage.getItem('omp_ui_density') as 'compact' | 'standard' | 'relaxed') || 'compact'
  );
  const [editorFont, setEditorFontState] = useState<string>(
    () => localStorage.getItem('omp_editor_font') || 'System Mono'
  );
  const [enableGrid, setEnableGridState] = useState<boolean>(() => localStorage.getItem('omp_enable_grid') === 'true');
  const [enableGlow, setEnableGlowState] = useState<boolean>(() => localStorage.getItem('omp_enable_glow') === 'true');

  // `auto` must follow a live OS change, not just the value read at boot.
  useEffect(() => {
    if (paletteId !== 'auto' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => setResolvedPalette(media.matches ? 'light' : 'dark');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [paletteId]);

  useEffect(() => {
    const resolved = resolvePalette(paletteId);
    setResolvedPalette(resolved);
    applyPalette(resolved, accentColor || null, editorFont);
    document.documentElement.setAttribute('data-density', uiDensity);
    try {
      localStorage.setItem('omp_palette', paletteId);
      localStorage.setItem('omp_ui_density', uiDensity);
      localStorage.setItem('omp_editor_font', editorFont);
      if (accentColor) localStorage.setItem('omp_accent_color', accentColor);
      else localStorage.removeItem('omp_accent_color');
    } catch {
      // storage unavailable — preferences simply won't persist
    }
  }, [paletteId, accentColor, uiDensity, editorFont]);

  useEffect(() => {
    try {
      localStorage.setItem('omp_enable_grid', String(enableGrid));
      localStorage.setItem('omp_enable_glow', String(enableGlow));
    } catch {
      // storage unavailable
    }
  }, [enableGrid, enableGlow]);

  const theme = paletteToThemeOption(resolvedPalette, accentColor || null);

  /** Picking one of the legacy presets maps onto the matching palette + accent. */
  const setTheme = (newTheme: ThemeOption) => {
    const nextPalette = newTheme.mode === 'light' ? 'light' : 'dark';
    setPaletteIdState(nextPalette);
    setAccentColorState(newTheme.accent);
  };

  const saveCustomTheme = (custom: ThemeOption) => {
    setPaletteIdState(custom.mode === 'light' ? 'light' : 'dark');
    setAccentColorState(custom.accent);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        saveCustomTheme,
        accentColor: theme.accent,
        setAccentColor: setAccentColorState,
        paletteId,
        setPaletteId: setPaletteIdState,
        resolvedPalette,
        uiDensity,
        setUiDensity: setUiDensityState,
        editorFont,
        setEditorFont: setEditorFontState,
        enableGrid,
        setEnableGrid: setEnableGridState,
        enableGlow,
        setEnableGlow: setEnableGlowState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/** Kept for callers that imported the preset list from here. */
export { THEME_OPTIONS };
