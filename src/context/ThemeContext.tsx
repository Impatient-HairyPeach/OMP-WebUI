import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemeOption } from '../types';
import {
  applyPalette,
  loadCustomPalette,
  loadPalettePreference,
  paletteToThemeOption,
  resolvePalette,
  saveCustomBase,
  storeCustomPalette,
  type CustomPalette,
  type PaletteId,
  type PalettePreference,
} from '../lib/palettes';

interface ThemeContextType {
  /** Active palette, mirrored into the shape components read inline. */
  theme: ThemeOption;
  /** Custom palette built in Settings → 界面主题与偏好. */
  customPalette: CustomPalette | null;
  saveCustomPalette: (palette: CustomPalette) => void;
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
  const [customPalette, setCustomPaletteState] = useState<CustomPalette | null>(() => loadCustomPalette());

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
    if (paletteId === 'custom' && customPalette) {
      // A custom palette paints its own tokens and fixes the base mode.
      applyPalette(customPalette.mode, accentColor || customPalette.accent, editorFont, customPalette);
    } else {
      applyPalette(resolved, accentColor || null, editorFont, null);
    }
    document.documentElement.setAttribute('data-density', uiDensity);
    try {
      localStorage.setItem('omp_palette', paletteId);
      if (paletteId === 'custom' && customPalette) saveCustomBase(customPalette.mode);
      localStorage.setItem('omp_ui_density', uiDensity);
      localStorage.setItem('omp_editor_font', editorFont);
      if (accentColor) localStorage.setItem('omp_accent_color', accentColor);
      else localStorage.removeItem('omp_accent_color');
    } catch {
      // storage unavailable — preferences simply won't persist
    }
  }, [paletteId, accentColor, uiDensity, editorFont, customPalette]);

  useEffect(() => {
    try {
      localStorage.setItem('omp_enable_grid', String(enableGrid));
      localStorage.setItem('omp_enable_glow', String(enableGlow));
    } catch {
      // storage unavailable
    }
  }, [enableGrid, enableGlow]);

  const theme = paletteToThemeOption(
    customPalette && paletteId === 'custom' ? customPalette.mode : resolvedPalette,
    accentColor || customPalette?.accent || null
  );

  /** Persist the custom palette built in Settings and switch to it. */
  const saveCustomPalette = (palette: CustomPalette) => {
    setCustomPaletteState(palette);
    storeCustomPalette(palette);
    setPaletteIdState('custom');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        customPalette,
        saveCustomPalette,
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
