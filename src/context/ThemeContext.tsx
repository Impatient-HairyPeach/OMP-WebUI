import React, { createContext, useContext, useState, useEffect } from 'react';
import { ThemeOption } from '../types';
import { THEME_OPTIONS } from '../components/views/ThemeView';

interface ThemeContextType {
  theme: ThemeOption;
  setTheme: (theme: ThemeOption) => void;
  saveCustomTheme: (customTheme: ThemeOption) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
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
  const [theme, setThemeState] = useState<ThemeOption>(() => {
    const saved = localStorage.getItem('omp_theme_id');
    if (saved === 'custom-theme') {
      try {
        const rawCustom = localStorage.getItem('omp_custom_theme_data');
        if (rawCustom) {
          return JSON.parse(rawCustom);
        }
      } catch (err) {
        // fallback to default
      }
    }
    const match = THEME_OPTIONS.find((t) => t.id === saved);
    return match || THEME_OPTIONS[0];
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem('omp_accent_color') || theme.accent;
  });

  const [uiDensity, setUiDensityState] = useState<'compact' | 'standard' | 'relaxed'>(() => {
    return (localStorage.getItem('omp_ui_density') as 'compact' | 'standard' | 'relaxed') || 'compact';
  });

  const [editorFont, setEditorFontState] = useState<string>(() => {
    return localStorage.getItem('omp_editor_font') || 'Geist Mono';
  });

  const [enableGrid, setEnableGridState] = useState<boolean>(() => {
    return localStorage.getItem('omp_enable_grid') !== 'false';
  });

  const [enableGlow, setEnableGlowState] = useState<boolean>(() => {
    return localStorage.getItem('omp_enable_glow') !== 'false';
  });

  // Apply theme & styling dynamically to root document
  useEffect(() => {
    const root = document.documentElement;
    const isLight = theme.mode === 'light';
    root.setAttribute('data-theme', theme.id);
    root.setAttribute('data-theme-mode', isLight ? 'light' : 'dark');
    root.setAttribute('data-density', uiDensity);

    if (isLight) {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }

    const textColor = isLight ? (theme.text || '#0f172a') : '#fafafa';
    const textMutedColor = isLight ? (theme.textMuted || '#475569') : '#a1a1aa';

    root.style.setProperty('--theme-bg', theme.background);
    root.style.setProperty('--theme-card', theme.cardBg);
    root.style.setProperty('--theme-border', theme.border);
    root.style.setProperty('--theme-accent', accentColor);
    root.style.setProperty('--theme-secondary', theme.secondary);
    root.style.setProperty('--theme-text', textColor);
    root.style.setProperty('--theme-text-muted', textMutedColor);
    root.style.setProperty('--font-mono', `'${editorFont}', monospace`);

    document.body.style.backgroundColor = theme.background;
    document.body.style.color = textColor;
    document.body.style.fontFamily = uiDensity === 'relaxed' ? 'var(--font-sans)' : '';

    localStorage.setItem('omp_theme_id', theme.id);
    localStorage.setItem('omp_accent_color', accentColor);
    localStorage.setItem('omp_ui_density', uiDensity);
    localStorage.setItem('omp_editor_font', editorFont);
    localStorage.setItem('omp_enable_grid', String(enableGrid));
    localStorage.setItem('omp_enable_glow', String(enableGlow));
  }, [theme, accentColor, uiDensity, editorFont, enableGrid, enableGlow]);

  const setTheme = (newTheme: ThemeOption) => {
    setThemeState(newTheme);
    setAccentColorState(newTheme.accent);
  };

  const saveCustomTheme = (custom: ThemeOption) => {
    localStorage.setItem('omp_custom_theme_data', JSON.stringify(custom));
    localStorage.setItem('omp_theme_id', custom.id);
    setThemeState(custom);
    setAccentColorState(custom.accent);
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
  };

  const setUiDensity = (density: 'compact' | 'standard' | 'relaxed') => {
    setUiDensityState(density);
  };

  const setEditorFont = (font: string) => {
    setEditorFontState(font);
  };

  const setEnableGrid = (enabled: boolean) => {
    setEnableGridState(enabled);
  };

  const setEnableGlow = (enabled: boolean) => {
    setEnableGlowState(enabled);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        saveCustomTheme,
        accentColor,
        setAccentColor,
        uiDensity,
        setUiDensity,
        editorFont,
        setEditorFont,
        enableGrid,
        setEnableGrid,
        enableGlow,
        setEnableGlow,
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
