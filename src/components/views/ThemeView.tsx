import React, { useState } from 'react';
import {
  Palette,
  Check,
  Sparkles,
  Sliders,
  Type,
  Maximize2,
  Minimize2,
  Terminal,
  Cpu,
  Shield,
  Layers,
  CheckCircle2,
  RefreshCw,
  Eye,
  Globe,
} from 'lucide-react';
import { ThemeOption } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';

interface ThemeViewProps {
  onSelectTheme?: (theme: ThemeOption) => void;
  onSelectAccentColor?: (color: string) => void;
}

export const THEME_OPTIONS: ThemeOption[] = [
  // ==========================================
  // LIGHT THEMES (浅色主题)
  // ==========================================
  {
    id: 'github-light',
    name: 'GitHub Light',
    category: 'Light',
    description: 'Official GitHub Primer light design system with crisp white surfaces (#ffffff), #d0d7de borders, and GitHub blue.',
    accent: '#0969da',
    secondary: '#1a7f37',
    background: '#ffffff',
    cardBg: '#f6f8fa',
    border: '#d0d7de',
    tag: 'Canonical',
    mode: 'light',
    text: '#1f2328',
    textMuted: '#656d76',
  },
  {
    id: 'vscode-light',
    name: 'VS Code Light+',
    category: 'Light',
    description: 'Standard Visual Studio Code light theme with royal blue accents (#2563eb), slate cards, and zinc borders.',
    accent: '#2563eb',
    secondary: '#059669',
    background: '#f8f9fa',
    cardBg: '#ffffff',
    border: '#e5e7eb',
    tag: 'Canonical',
    mode: 'light',
    text: '#111827',
    textMuted: '#4b5563',
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    category: 'Light',
    description: 'Original Ethan Schoonover specification with warm base3 cream (#fdf6e3), base2 surfaces, and solar amber (#b58900).',
    accent: '#b58900',
    secondary: '#2aa198',
    background: '#fdf6e3',
    cardBg: '#eee8d5',
    border: '#d8d2bf',
    tag: 'Canonical',
    mode: 'light',
    text: '#073642',
    textMuted: '#586e75',
  },
  {
    id: 'nord-light',
    name: 'Nord Snow Storm',
    category: 'Light',
    description: 'Official Arctic Ice Studio Nord Snow Storm light palette (#eceff4) with frost blue (#5e81ac) and glacier slate.',
    accent: '#5e81ac',
    secondary: '#8fbcbb',
    background: '#eceff4',
    cardBg: '#ffffff',
    border: '#d8dee9',
    tag: 'Canonical',
    mode: 'light',
    text: '#2e3440',
    textMuted: '#4c566a',
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'Light',
    description: 'Official Catppuccin Latte soothing light palette (#eff1f5) with Mauve purple (#8839ef) and Mint green.',
    accent: '#8839ef',
    secondary: '#40a02b',
    background: '#eff1f5',
    cardBg: '#ffffff',
    border: '#ccd0da',
    tag: 'Community',
    mode: 'light',
    text: '#4c4f69',
    textMuted: '#6c6f85',
  },
  {
    id: 'shadcn-light',
    name: 'Shadcn Zinc Clean Light',
    category: 'Light',
    description: 'Minimalist Zinc design system with pure white canvas (#ffffff), light gray cards (#fafafa), and zinc accents.',
    accent: '#18181b',
    secondary: '#10b981',
    background: '#ffffff',
    cardBg: '#fafafa',
    border: '#e4e4e7',
    tag: 'Minimalist',
    mode: 'light',
    text: '#09090b',
    textMuted: '#71717a',
  },
  {
    id: 'tokyo-night-light',
    name: 'Tokyo Night Light',
    category: 'Light',
    description: 'Official Tokyo Night Day light palette with crisp cloud surface (#e1e2e7), clean cards, and cobalt blue accents.',
    accent: '#3760bf',
    secondary: '#587539',
    background: '#e1e2e7',
    cardBg: '#f2f3f5',
    border: '#d5d6db',
    tag: 'Canonical',
    mode: 'light',
    text: '#343b58',
    textMuted: '#68709a',
  },
  {
    id: 'gruvbox-light',
    name: 'Gruvbox Warm Light',
    category: 'Light',
    description: 'Vintage warm parchment light palette (#fbf1c7) with ochre amber (#b57614) and moss green.',
    accent: '#b57614',
    secondary: '#79740e',
    background: '#fbf1c7',
    cardBg: '#f2e5bc',
    border: '#d5c4a1',
    tag: 'Classic',
    mode: 'light',
    text: '#3c3836',
    textMuted: '#7c6f64',
  },
  {
    id: 'warm-sepia',
    name: 'Warm Sepia & Coffee',
    category: 'Light',
    description: 'Cozy parchment and roasted coffee bean light theme (#f7f3ee) with rich caramel amber accents.',
    accent: '#96603d',
    secondary: '#607353',
    background: '#f7f3ee',
    cardBg: '#eee6dc',
    border: '#d9ccbe',
    tag: 'Cozy',
    mode: 'light',
    text: '#382c26',
    textMuted: '#79685e',
  },
  {
    id: 'ayu-light',
    name: 'Ayu Light',
    category: 'Light',
    description: 'Original Ayu Light editor palette with clean pearl surface (#fafafa), sunset orange (#ff6a00), and sky blue.',
    accent: '#ff6a00',
    secondary: '#399ee6',
    background: '#fcfcfc',
    cardBg: '#f3f4f5',
    border: '#e0e2e5',
    tag: 'Modern',
    mode: 'light',
    text: '#5c6166',
    textMuted: '#8a9199',
  },
  {
    id: 'everforest-light',
    name: 'Everforest Light Soft',
    category: 'Light',
    description: 'Comfortable natural green paper theme (#f8f5e4) with sage emerald (#8da101) and bronze earth tones.',
    accent: '#8da101',
    secondary: '#3a94c5',
    background: '#f8f5e4',
    cardBg: '#edeada',
    border: '#ded9c7',
    tag: 'Nature',
    mode: 'light',
    text: '#5c6a72',
    textMuted: '#939f91',
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    category: 'Light',
    description: 'Nordic soft sunlight parchment (#faf4ed) with dusty rose pink (#b4637a) and pine needle teal (#286983).',
    accent: '#b4637a',
    secondary: '#286983',
    background: '#faf4ed',
    cardBg: '#fffaf3',
    border: '#f2e9de',
    tag: 'Aesthetic',
    mode: 'light',
    text: '#575279',
    textMuted: '#797593',
  },
  {
    id: 'vitesse-light',
    name: 'Vitesse Light (Anthony Fu)',
    category: 'Light',
    description: 'Anthony Fu icon-grade minimalist light theme (#ffffff) with carbon borders (#e5e5e5) and vivid amber.',
    accent: '#ea580c',
    secondary: '#16a34a',
    background: '#ffffff',
    cardBg: '#f5f5f5',
    border: '#e5e5e5',
    tag: 'Minimalist',
    mode: 'light',
    text: '#262626',
    textMuted: '#737373',
  },
  {
    id: 'material-light',
    name: 'Material Lighter',
    category: 'Light',
    description: 'Clean Google Material Design specification (#fafafa) with deep Indigo (#3f51b5) and teal accents.',
    accent: '#3f51b5',
    secondary: '#009688',
    background: '#fafafa',
    cardBg: '#ffffff',
    border: '#e0e0e0',
    tag: 'Canonical',
    mode: 'light',
    text: '#212121',
    textMuted: '#757575',
  },

  // ==========================================
  // DARK THEMES (深色主题)
  // ==========================================
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'Light',
    description: 'Catppuccin Latte pastel light palette: lavender surfaces (#eff1f5), mauve accents (#8839ef), and soft charcoal text.',
    accent: '#8839ef',
    secondary: '#1e66f5',
    background: '#eff1f5',
    cardBg: '#ffffff',
    border: '#dce0e8',
    tag: 'Community',
    mode: 'light',
    text: '#4c4f69',
    textMuted: '#8c8fa1',
  },
  {
    id: 'paper-ink',
    name: 'Paper & Ink',
    category: 'Light',
    description: 'Warm drafting-paper light theme (#f7f6f2) with ink-amber accents (#b45309) and teal secondary — easy on long reviews.',
    accent: '#b45309',
    secondary: '#0f766e',
    background: '#f7f6f2',
    cardBg: '#ffffff',
    border: '#e0ddd4',
    tag: 'Cozy',
    mode: 'light',
    text: '#1c1917',
    textMuted: '#78716c',
  },
  {
    id: 'mint-sandbox',
    name: 'Mint Sandbox',
    category: 'Light',
    description: 'Cool mint light surface (#f2fbf7) with teal accents and emerald status — reads well beside sandboxed terminal output.',
    accent: '#0d9488',
    secondary: '#10b981',
    background: '#f2fbf7',
    cardBg: '#ffffff',
    border: '#d1e7dd',
    tag: 'Modern',
    mode: 'light',
    text: '#0f172a',
    textMuted: '#64748b',
  },
  {
    id: 'high-contrast-light',
    name: 'High Contrast Light',
    category: 'Light',
    description: 'Accessibility-first light theme: pure white surfaces, near-black borders (#111111) and AA-contrast blue accents.',
    accent: '#0043ce',
    secondary: '#a2191f',
    background: '#ffffff',
    cardBg: '#f2f2f2',
    border: '#111111',
    tag: 'Minimalist',
    mode: 'light',
    text: '#000000',
    textMuted: '#333333',
  },

  // ==========================================
  // DARK THEMES (深色主题)
  // ==========================================
  {
    id: 'obsidian',
    name: 'Obsidian Precision',
    category: 'Dark',
    description: 'Developer-grade near-black Obsidian surface (#09090b) with electric soft violet accents and emerald status.',
    accent: '#a78bfa',
    secondary: '#34d399',
    background: '#09090b',
    cardBg: '#121215',
    border: '#27272a',
    tag: 'Default',
    mode: 'dark',
    text: '#fafafa',
    textMuted: '#a1a1aa',
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark Dimmed',
    category: 'Dark',
    description: 'Official GitHub dark palette (#0d1117) with #30363d borders, subtle charcoal cards, and GitHub blue accents.',
    accent: '#2f81f7',
    secondary: '#3fb950',
    background: '#0d1117',
    cardBg: '#161b22',
    border: '#30363d',
    tag: 'Canonical',
    mode: 'dark',
    text: '#e6edf3',
    textMuted: '#8b949e',
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    category: 'Dark',
    description: 'Canonical Tokyo Night palette (#1a1b26) with deep storm cards (#24283b), neon cyan (#7aa2f7), and lavender.',
    accent: '#7aa2f7',
    secondary: '#bb9af7',
    background: '#1a1b26',
    cardBg: '#24283b',
    border: '#292e42',
    tag: 'Canonical',
    mode: 'dark',
    text: '#c0caf5',
    textMuted: '#7aa2f7',
  },
  {
    id: 'dracula',
    name: 'Dracula',
    category: 'Dark',
    description: 'Official Dracula specification (#21222c) with gothic slate (#282a36), purple (#bd93f9), and green.',
    accent: '#bd93f9',
    secondary: '#50fa7b',
    background: '#21222c',
    cardBg: '#282a36',
    border: '#44475a',
    tag: 'Canonical',
    mode: 'dark',
    text: '#f8f8f2',
    textMuted: '#6272a4',
  },
  {
    id: 'nordic',
    name: 'Nord Polar Night',
    category: 'Dark',
    description: 'Official Nord Arctic Ice polar night palette (#2e3440) with aurora cyan (#88c0d0) and frost borders.',
    accent: '#88c0d0',
    secondary: '#a3be8c',
    background: '#2e3440',
    cardBg: '#3b4252',
    border: '#434c5e',
    tag: 'Canonical',
    mode: 'dark',
    text: '#eceff4',
    textMuted: '#d8dee9',
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    category: 'Dark',
    description: 'Atom legendary One Dark Pro theme (#282c34) with vibrant sky blue (#61afef) and sage green accents.',
    accent: '#61afef',
    secondary: '#98c379',
    background: '#282c34',
    cardBg: '#21252b',
    border: '#181a1f',
    tag: 'Canonical',
    mode: 'dark',
    text: '#abb2bf',
    textMuted: '#5c6370',
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    category: 'Dark',
    description: 'Official Catppuccin Mocha palette (#1e1e2e) with mantle (#252538), lavender (#cba6f7), and mint.',
    accent: '#cba6f7',
    secondary: '#a6e3a1',
    background: '#1e1e2e',
    cardBg: '#252538',
    border: '#313244',
    tag: 'Community',
    mode: 'dark',
    text: '#cdd6f4',
    textMuted: '#a6adc8',
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    category: 'Dark',
    description: 'Official Monokai Pro filter octave palette (#2d2a2e) with amber (#ffd866) and acid lime highlights.',
    accent: '#ffd866',
    secondary: '#a9dc76',
    background: '#2d2a2e',
    cardBg: '#3a383c',
    border: '#49464b',
    tag: 'Canonical',
    mode: 'dark',
    text: '#fcfcfa',
    textMuted: '#939293',
  },
  {
    id: 'solarized',
    name: 'Solarized Dark',
    category: 'Dark',
    description: 'Original Ethan Schoonover solarized dark (#002b36) with deep oceanic base02 (#073642) and cyan.',
    accent: '#268bd2',
    secondary: '#2aa198',
    background: '#002b36',
    cardBg: '#073642',
    border: '#0b4352',
    tag: 'Canonical',
    mode: 'dark',
    text: '#839496',
    textMuted: '#586e75',
  },
  {
    id: 'gruvbox-dark',
    name: 'Gruvbox Retro Dark',
    category: 'Dark',
    description: 'Iconic retro groove dark palette (#282828) with warm golden amber (#fabd2f) and earthy contrast.',
    accent: '#fabd2f',
    secondary: '#b8bb26',
    background: '#282828',
    cardBg: '#32302f',
    border: '#504945',
    tag: 'Classic',
    mode: 'dark',
    text: '#ebdbb2',
    textMuted: '#a89984',
  },
  {
    id: 'synthwave-84',
    name: "Synthwave '84",
    category: 'Dark',
    description: 'Legendary 80s retro neon aesthetic (#262335) with glowing neon pink (#ff7edb) and laser cyan (#36f9f6).',
    accent: '#ff7edb',
    secondary: '#36f9f6',
    background: '#262335',
    cardBg: '#2e2a40',
    border: '#494263',
    tag: 'Retro 80s',
    mode: 'dark',
    text: '#f92aad',
    textMuted: '#848bbd',
  },
  {
    id: 'ayu-mirage',
    name: 'Ayu Mirage',
    category: 'Dark',
    description: 'Modern sleek slate twilight dark theme (#1f2430) with warm sun gold (#ffcc66) and sky blue.',
    accent: '#ffcc66',
    secondary: '#73d0ff',
    background: '#1f2430',
    cardBg: '#232834',
    border: '#333846',
    tag: 'Modern',
    mode: 'dark',
    text: '#cbccc6',
    textMuted: '#707a8c',
  },
  {
    id: 'palenight',
    name: 'Material Palenight',
    category: 'Dark',
    description: 'Canonical Material Theme Palenight (#292d3e) with soothing amethyst violet (#c792ea) and cyan.',
    accent: '#c792ea',
    secondary: '#89ddff',
    background: '#292d3e',
    cardBg: '#32374d',
    border: '#3e445e',
    tag: 'Canonical',
    mode: 'dark',
    text: '#eeffff',
    textMuted: '#8796b0',
  },
  {
    id: 'jetbrains-darcula',
    name: 'JetBrains Darcula',
    category: 'Dark',
    description: 'Official IntelliJ IDEA and WebStorm IDE classic Darcula (#2b2b2b) with royal blue and olive green.',
    accent: '#4a90e2',
    secondary: '#629755',
    background: '#2b2b2b',
    cardBg: '#3c3f41',
    border: '#4e5254',
    tag: 'IDE Classic',
    mode: 'dark',
    text: '#a9b7c6',
    textMuted: '#808080',
  },
  {
    id: 'vesper-dark',
    name: 'Vesper Modern Carbon',
    category: 'Dark',
    description: 'Ultra-clean carbon black surface (#101010) with warm peach amber accents (#ffc799) and mint.',
    accent: '#ffc799',
    secondary: '#99ffe4',
    background: '#101010',
    cardBg: '#161616',
    border: '#232323',
    tag: 'Minimal Carbon',
    mode: 'dark',
    text: '#ffffff',
    textMuted: '#8b8b8b',
  },
  {
    id: 'cobalt2',
    name: 'Cobalt2 Official',
    category: 'Dark',
    description: 'Iconic Wes Bos Cobalt2 deep navy palette (#193549) with high-voltage bright yellow (#ffc600) highlights.',
    accent: '#ffc600',
    secondary: '#0088ff',
    background: '#193549',
    cardBg: '#15232d',
    border: '#1f4662',
    tag: 'Iconic',
    mode: 'dark',
    text: '#ffffff',
    textMuted: '#7f99b2',
  },
  {
    id: 'rose-pine-moon',
    name: 'Rosé Pine Moon',
    category: 'Dark',
    description: 'Warm twilight pine palette (#232136) with soft rose (#ea9a97) and lilac iris accents.',
    accent: '#ea9a97',
    secondary: '#c4a7e7',
    background: '#232136',
    cardBg: '#2a273f',
    border: '#393552',
    tag: 'Aesthetic',
    mode: 'dark',
    text: '#e0def4',
    textMuted: '#908caa',
  },
  {
    id: 'everforest-dark',
    name: 'Everforest Dark',
    category: 'Dark',
    description: 'Calm natural forest sanctuary dark (#2d353b) with soothing sage green (#a7c080) and warm wood tones.',
    accent: '#a7c080',
    secondary: '#83c092',
    background: '#2d353b',
    cardBg: '#343f44',
    border: '#475258',
    tag: 'Nature',
    mode: 'dark',
    text: '#d3c6aa',
    textMuted: '#859289',
  },
  {
    id: 'linear-black',
    name: 'Linear OLED Pure Black',
    category: 'Dark',
    description: 'Ultra-deep #000000 true black with Linear modern indigo (#5e6ad2) and hairline gray borders.',
    accent: '#5e6ad2',
    secondary: '#4ea8de',
    background: '#000000',
    cardBg: '#09090b',
    border: '#1f1f23',
    tag: 'OLED Saver',
    mode: 'dark',
    text: '#fafafa',
    textMuted: '#8a8f98',
  },
  {
    id: 'matrix',
    name: 'Matrix OLED Pure Black',
    category: 'Dark',
    description: 'True pitch #000000 black surface with radioactive phosphor green (#22c55e) glow.',
    accent: '#22c55e',
    secondary: '#16a34a',
    background: '#000000',
    cardBg: '#0a0a0a',
    border: '#1f1f1f',
    tag: 'OLED Saver',
    mode: 'dark',
    text: '#f0fdf4',
    textMuted: '#86efac',
  },
  {
    id: 'cyberpunk-2077',
    name: 'Cyberpunk 2077',
    category: 'Dark',
    description: 'Night City high-octane dark (#0d0d17) with radiant electric yellow (#fee801) and neon hot pink.',
    accent: '#fee801',
    secondary: '#ff0055',
    background: '#0d0d17',
    cardBg: '#181829',
    border: '#2c224d',
    tag: 'Cyberpunk',
    mode: 'dark',
    text: '#00ffff',
    textMuted: '#9999bb',
  },
];

export const ACCENT_SWATCHES = [
  { name: 'Soft Violet', color: '#a78bfa' },
  { name: 'Electric Cyan', color: '#38bdf8' },
  { name: 'Emerald', color: '#34d399' },
  { name: 'Rose', color: '#fb7185' },
  { name: 'Amber Gold', color: '#fbbf24' },
  { name: 'Sunset Orange', color: '#fb923c' },
  { name: 'Indigo', color: '#818cf8' },
  { name: 'Neon Lime', color: '#a3e635' },
];

export const ThemeView: React.FC<ThemeViewProps> = ({
  onSelectTheme,
  onSelectAccentColor,
}) => {
  const {
    theme: activeTheme,
    setTheme,
    saveCustomTheme,
    accentColor: activeAccentColor,
    setAccentColor,
    uiDensity,
    setUiDensity,
    editorFont,
    setEditorFont,
    enableGrid: enableGridBackground,
    setEnableGrid: setEnableGridBackground,
    enableGlow: enableGlowEffects,
    setEnableGlow: setEnableGlowEffects,
  } = useTheme();

  const { language, setLanguage, t } = useI18n();

  const [terminalAutoScroll, setTerminalAutoScroll] = useState(true);
  const [showLatency, setShowLatency] = useState(true);
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>('all');

  // Custom Theme Builder state
  const [customName, setCustomName] = useState('My Studio Custom');
  const [customMode, setCustomMode] = useState<'dark' | 'light'>(activeTheme.mode || 'dark');
  const [customBg, setCustomBg] = useState(activeTheme.background || '#0d1117');
  const [customCard, setCustomCard] = useState(activeTheme.cardBg || '#161b22');
  const [customBorder, setCustomBorder] = useState(activeTheme.border || '#30363d');
  const [customAccent, setCustomAccent] = useState(activeTheme.accent || '#a78bfa');
  const [customSecondary, setCustomSecondary] = useState(activeTheme.secondary || '#34d399');
  const [customTextColor, setCustomTextColor] = useState(activeTheme.text || '#fafafa');
  const [customTextMuted, setCustomTextMuted] = useState(activeTheme.textMuted || '#a1a1aa');
  const [customAppliedNotice, setCustomAppliedNotice] = useState(false);

  // Quick preset inspirations for custom builder
  const customPresets = [
    {
      name: 'Emerald Matrix',
      mode: 'dark' as const,
      bg: '#04130e',
      card: '#092119',
      border: '#12382c',
      accent: '#10b981',
      secondary: '#34d399',
      text: '#ecfdf5',
      textMuted: '#6ee7b7',
    },
    {
      name: 'Royal Indigo',
      mode: 'dark' as const,
      bg: '#0c0e1a',
      card: '#141829',
      border: '#252b47',
      accent: '#6366f1',
      secondary: '#38bdf8',
      text: '#f8fafc',
      textMuted: '#94a3b8',
    },
    {
      name: 'Crimson Velvet',
      mode: 'dark' as const,
      bg: '#18080c',
      card: '#251016',
      border: '#3f1a24',
      accent: '#f43f5e',
      secondary: '#fb7185',
      text: '#fff1f2',
      textMuted: '#fda4af',
    },
    {
      name: 'Nordic Frost Light',
      mode: 'light' as const,
      bg: '#f1f5f9',
      card: '#ffffff',
      border: '#cbd5e1',
      accent: '#0284c7',
      secondary: '#0d9488',
      text: '#0f172a',
      textMuted: '#64748b',
    },
    {
      name: 'Warm Amber Parchment',
      mode: 'light' as const,
      bg: '#fdfbf7',
      card: '#f5f0e6',
      border: '#e6dac8',
      accent: '#d97706',
      secondary: '#059669',
      text: '#451a03',
      textMuted: '#78350f',
    },
  ];

  const handleApplyPresetToBuilder = (p: typeof customPresets[0]) => {
    setCustomName(p.name);
    setCustomMode(p.mode);
    setCustomBg(p.bg);
    setCustomCard(p.card);
    setCustomBorder(p.border);
    setCustomAccent(p.accent);
    setCustomSecondary(p.secondary);
    setCustomTextColor(p.text);
    setCustomTextMuted(p.textMuted);
  };

  const handleSaveAndApplyCustomTheme = () => {
    const customThemeObj: ThemeOption = {
      id: 'custom-theme',
      name: customName.trim() || (language === 'zh-CN' ? '自定义专属主题' : 'Custom Theme'),
      category: 'Custom Theme',
      description: language === 'zh-CN'
        ? `自定义开发者工作区主题（${customMode === 'light' ? '明亮' : '暗黑'}模式），高亮色为 ${customAccent}。`
        : `Custom developer workspace theme (${customMode === 'light' ? 'Light' : 'Dark'} mode) with ${customAccent} accents.`,
      accent: customAccent,
      secondary: customSecondary,
      background: customBg,
      cardBg: customCard,
      border: customBorder,
      tag: language === 'zh-CN' ? '自定义' : 'Custom',
      mode: customMode,
      text: customTextColor,
      textMuted: customTextMuted,
    };
    saveCustomTheme(customThemeObj);
    onSelectTheme?.(customThemeObj);
    setCustomAppliedNotice(true);
    setTimeout(() => setCustomAppliedNotice(false), 2500);
  };

  const handleResetCustomTheme = () => {
    const defaultTheme = THEME_OPTIONS[0];
    setTheme(defaultTheme);
    onSelectTheme?.(defaultTheme);
  };

  const selectedThemeId = activeTheme.id;

  const handleChooseTheme = (theme: ThemeOption) => {
    setTheme(theme);
    onSelectTheme?.(theme);
  };

  const handleChooseAccent = (color: string) => {
    setAccentColor(color);
    onSelectAccentColor?.(color);
  };

  const categoryMap: { key: string; labelEn: string; labelZh: string }[] = [
    { key: 'all', labelEn: 'All Themes', labelZh: '全部主题' },
    { key: 'Dark', labelEn: 'Dark Themes', labelZh: '深色主题' },
    { key: 'Light', labelEn: 'Light Themes', labelZh: '浅色主题' },
  ];

  // Include active custom theme in list if it is a custom theme
  const allThemesList = activeTheme.id === 'custom-theme'
    ? [activeTheme, ...THEME_OPTIONS.filter((t) => t.id !== 'custom-theme')]
    : THEME_OPTIONS;

  const filteredThemes = activeFilterCategory === 'all'
    ? allThemesList
    : activeFilterCategory === 'Light'
    ? allThemesList.filter((t) => t.mode === 'light' || t.category === 'Light')
    : allThemesList.filter((t) => t.mode === 'dark' || t.category === 'Dark');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#a78bfa]" style={{ color: customAccent }} />
            {t.uiThemeStudio}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {t.uiThemeDesc}
          </p>
        </div>

        {/* Current Active Badge */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-[#121215] border border-[#27272a] text-xs font-mono">
          <span className="text-[10px] text-[#71717a] uppercase">Active:</span>
          <div className="flex items-center gap-1.5 font-semibold text-[#fafafa]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: customAccent }}
            />
            <span>{activeTheme.name}</span>
          </div>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#18181b] text-[#a1a1aa] border border-[#27272a]">
            {activeTheme.mode === 'light' ? 'Light' : 'Dark'} · {uiDensity}
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 0: LANGUAGE SELECTION (语言选项)                 */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-lg border space-y-3 transition-colors"
        style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-xs" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
              <Globe className="w-4 h-4" style={{ color: customAccent }} />
              <span>{t.languageSelect}</span>
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: activeTheme.mode === 'light' ? '#64748b' : '#71717a' }}>
              {t.languageSelectDesc}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage('zh-CN')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium transition-all cursor-pointer ${
                language === 'zh-CN'
                  ? 'font-semibold shadow-sm'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              style={{
                backgroundColor: language === 'zh-CN' ? (activeTheme.mode === 'light' ? '#f1f5f9' : '#18181b') : 'transparent',
                borderColor: language === 'zh-CN' ? customAccent : activeTheme.border,
                color: language === 'zh-CN' ? customAccent : undefined,
              }}
            >
              <span>🇨🇳 简体中文</span>
              {language === 'zh-CN' && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>

            <button
              type="button"
              onClick={() => setLanguage('en-US')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-medium transition-all cursor-pointer ${
                language === 'en-US'
                  ? 'font-semibold shadow-sm'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'
              }`}
              style={{
                backgroundColor: language === 'en-US' ? (activeTheme.mode === 'light' ? '#f1f5f9' : '#18181b') : 'transparent',
                borderColor: language === 'en-US' ? customAccent : activeTheme.border,
                color: language === 'en-US' ? customAccent : undefined,
              }}
            >
              <span>🇺🇸 English (US)</span>
              {language === 'en-US' && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: CURATED THEME PRESETS                         */}
      {/* ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" style={{ color: customAccent }} />
              {t.curatedPresets} ({THEME_OPTIONS.length})
            </h3>
            <p className="text-[11px] text-[#71717a]">
              {t.curatedPresetsDesc}
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 bg-[#121215] p-1 rounded border border-[#27272a] text-[11px] font-mono flex-wrap">
            {categoryMap.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setActiveFilterCategory(cat.key)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  activeFilterCategory === cat.key
                    ? 'bg-[#18181b] text-[#fafafa] font-semibold border border-[#3f3f46]'
                    : 'text-[#71717a] hover:text-[#a1a1aa]'
                }`}
              >
                {language === 'zh-CN' ? cat.labelZh : cat.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Theme Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {filteredThemes.map((theme) => {
            const isSelected = selectedThemeId === theme.id;

            return (
              <div
                key={theme.id}
                onClick={() => handleChooseTheme(theme)}
                className={`relative p-3.5 rounded-lg border transition-all cursor-pointer group flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#a78bfa] shadow-lg'
                    : 'border-[#27272a] hover:border-[#3f3f46]'
                }`}
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: isSelected ? theme.accent : undefined,
                  boxShadow: isSelected && enableGlowEffects ? `0 0 20px ${theme.accent}15` : undefined,
                }}
              >
                {/* Top: Name & Tag */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className="text-xs font-semibold flex items-center gap-2"
                      style={{ color: theme.mode === 'light' ? '#0f172a' : '#fafafa' }}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                        style={{ backgroundColor: theme.accent }}
                      />
                      <span className="truncate">{theme.name}</span>
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.2 rounded border font-mono shrink-0"
                      style={{
                        backgroundColor: `${theme.accent}15`,
                        borderColor: `${theme.accent}40`,
                        color: theme.accent,
                      }}
                    >
                      {language === 'zh-CN'
                        ? theme.tag === 'Canonical'
                          ? '官方经典'
                          : theme.tag === 'Minimalist'
                          ? '极简主义'
                          : theme.tag === 'High-Contrast'
                          ? '高对比度'
                          : theme.tag === 'Community'
                          ? '热门社区'
                          : theme.tag === 'OLED Saver'
                          ? 'OLED 省电'
                          : theme.tag === 'Retro 80s'
                          ? '80年代复古'
                          : theme.tag === 'IDE Classic'
                          ? 'IDE 经典'
                          : theme.tag === 'Minimal Carbon'
                          ? '极简碳黑'
                          : theme.tag === 'Iconic'
                          ? '标志性设计'
                          : theme.tag === 'Cozy'
                          ? '温暖舒适'
                          : theme.tag === 'Modern'
                          ? '现代流行'
                          : theme.tag
                        : theme.tag}
                    </span>
                  </div>

                  <p
                    className="text-[11px] leading-relaxed line-clamp-2"
                    style={{ color: theme.mode === 'light' ? '#475569' : '#a1a1aa' }}
                  >
                    {theme.description}
                  </p>
                </div>

                {/* Bottom: Palette Swatch Preview & Check */}
                <div
                  className="mt-3 pt-2.5 border-t flex items-center justify-between"
                  style={{ borderColor: theme.mode === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-1.5">
                    {/* Background Swatch */}
                    <div
                      className="w-5 h-5 rounded border flex items-center justify-center text-[8px] font-mono"
                      style={{
                        backgroundColor: theme.background,
                        borderColor: theme.mode === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.15)',
                        color: theme.mode === 'light' ? '#64748b' : 'rgba(255,255,255,0.6)',
                      }}
                      title={`Background: ${theme.background}`}
                    >
                      bg
                    </div>
                    {/* Card Swatch */}
                    <div
                      className="w-5 h-5 rounded border"
                      style={{
                        backgroundColor: theme.cardBg,
                        borderColor: theme.mode === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.15)',
                      }}
                      title={`Card: ${theme.cardBg}`}
                    />
                    {/* Accent Swatch */}
                    <div
                      className="w-5 h-5 rounded border shadow-sm"
                      style={{
                        backgroundColor: theme.accent,
                        borderColor: theme.mode === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.15)',
                      }}
                      title={`Accent: ${theme.accent}`}
                    />
                    {/* Secondary Swatch */}
                    <div
                      className="w-5 h-5 rounded border"
                      style={{
                        backgroundColor: theme.secondary,
                        borderColor: theme.mode === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.15)',
                      }}
                      title={`Secondary: ${theme.secondary}`}
                    />
                  </div>

                  {isSelected ? (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: theme.accent, color: theme.mode === 'light' ? '#ffffff' : '#09090b' }}
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  ) : (
                    <span
                      className="text-[10px] font-mono group-hover:underline"
                      style={{ color: theme.mode === 'light' ? '#64748b' : '#71717a' }}
                    >
                      {language === 'zh-CN' ? '点击应用' : 'Apply'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1.5: CUSTOM THEME STUDIO (自定义主题工作区)      */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-lg border space-y-4 transition-colors"
        style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3" style={{ borderColor: activeTheme.border }}>
          <div>
            <h3 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
              <Palette className="w-4 h-4" style={{ color: customAccent }} />
              {t.customTheme}
            </h3>
            <p className="text-[11px] mt-0.5" style={{ color: activeTheme.mode === 'light' ? '#64748b' : '#71717a' }}>
              {t.customThemeDesc}
            </p>
          </div>

          {/* Quick preset templates */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono" style={{ color: activeTheme.mode === 'light' ? '#64748b' : '#71717a' }}>
              {t.themeQuickPresets}:
            </span>
            {customPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleApplyPresetToBuilder(preset)}
                className="px-2 py-1 rounded text-[10px] font-mono border transition-all cursor-pointer hover:scale-105"
                style={{
                  backgroundColor: preset.card,
                  borderColor: preset.border,
                  color: preset.accent,
                }}
                title={`Apply ${preset.name} palette to customizer`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Theme Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Col 1: Basic Info & Mode */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customThemeName}
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="My Custom Studio"
                className="w-full h-8 px-2.5 rounded border text-xs font-mono focus:outline-none"
                style={{
                  backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                  borderColor: activeTheme.border,
                  color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customBaseMode}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCustomMode('dark')}
                  className={`py-1.5 px-3 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                    customMode === 'dark' ? 'font-semibold' : 'opacity-70'
                  }`}
                  style={{
                    backgroundColor: customMode === 'dark' ? (activeTheme.mode === 'light' ? '#e2e8f0' : '#18181b') : 'transparent',
                    borderColor: customMode === 'dark' ? customAccent : activeTheme.border,
                    color: customMode === 'dark' ? customAccent : undefined,
                  }}
                >
                  🌙 {language === 'zh-CN' ? '暗色模式 (Dark)' : 'Dark Mode'}
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMode('light')}
                  className={`py-1.5 px-3 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                    customMode === 'light' ? 'font-semibold' : 'opacity-70'
                  }`}
                  style={{
                    backgroundColor: customMode === 'light' ? (activeTheme.mode === 'light' ? '#e2e8f0' : '#18181b') : 'transparent',
                    borderColor: customMode === 'light' ? customAccent : activeTheme.border,
                    color: customMode === 'light' ? customAccent : undefined,
                  }}
                >
                  ☀️ {language === 'zh-CN' ? '明亮模式 (Light)' : 'Light Mode'}
                </button>
              </div>
            </div>
          </div>

          {/* Col 2: Surfaces & Borders */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customBgColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer shrink-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customBg}
                  onChange={(e) => setCustomBg(e.target.value)}
                  className="w-full h-8 px-2 rounded border text-xs font-mono uppercase"
                  style={{
                    backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: activeTheme.border,
                    color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customCardColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customCard}
                  onChange={(e) => setCustomCard(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer shrink-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customCard}
                  onChange={(e) => setCustomCard(e.target.value)}
                  className="w-full h-8 px-2 rounded border text-xs font-mono uppercase"
                  style={{
                    backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: activeTheme.border,
                    color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customBorderColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customBorder}
                  onChange={(e) => setCustomBorder(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer shrink-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customBorder}
                  onChange={(e) => setCustomBorder(e.target.value)}
                  className="w-full h-8 px-2 rounded border text-xs font-mono uppercase"
                  style={{
                    backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: activeTheme.border,
                    color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Col 3: Accents & Text Colors */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customAccentColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer shrink-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customAccent}
                  onChange={(e) => setCustomAccent(e.target.value)}
                  className="w-full h-8 px-2 rounded border text-xs font-mono uppercase"
                  style={{
                    backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: activeTheme.border,
                    color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customSecondaryColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customSecondary}
                  onChange={(e) => setCustomSecondary(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer shrink-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customSecondary}
                  onChange={(e) => setCustomSecondary(e.target.value)}
                  className="w-full h-8 px-2 rounded border text-xs font-mono uppercase"
                  style={{
                    backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: activeTheme.border,
                    color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
                {t.customTextColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTextColor}
                  onChange={(e) => setCustomTextColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer shrink-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customTextColor}
                  onChange={(e) => setCustomTextColor(e.target.value)}
                  className="w-full h-8 px-2 rounded border text-xs font-mono uppercase"
                  style={{
                    backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
                    borderColor: activeTheme.border,
                    color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Bar & Action Buttons */}
        <div
          className="p-3 rounded border flex flex-col sm:flex-row items-center justify-between gap-3 mt-2"
          style={{
            backgroundColor: customBg,
            borderColor: customBorder,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shadow-sm"
              style={{ backgroundColor: customAccent }}
            />
            <span className="font-semibold text-xs font-mono" style={{ color: customTextColor }}>
              {customName}
            </span>
            <span
              className="text-[9px] px-2 py-0.5 rounded font-mono"
              style={{
                backgroundColor: customCard,
                color: customSecondary,
                border: `1px solid ${customBorder}`,
              }}
            >
              {customMode === 'light' ? 'Light Preview' : 'Dark Preview'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCustomTheme}
              className="px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer"
              style={{
                backgroundColor: customCard,
                borderColor: customBorder,
                color: customTextColor,
              }}
            >
              {t.customResetTheme}
            </button>
            <button
              type="button"
              onClick={handleSaveAndApplyCustomTheme}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold shadow-md transition-all cursor-pointer hover:opacity-95"
              style={{
                backgroundColor: customAccent,
                color: customMode === 'light' ? '#ffffff' : '#09090b',
              }}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t.customApplyTheme}</span>
            </button>
          </div>
        </div>

        {customAppliedNotice && (
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{t.customThemeSaveSuccess}</span>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: ACCENT OVERRIDES & TYPOGRAPHY                 */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Accent Color Customizer */}
        <div className="p-4 rounded-lg border border-[#27272a] bg-[#0c0c0e] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#a78bfa]" style={{ color: customAccent }} />
              {t.accentTintCustomizer}
            </h4>
            <span className="text-[10px] font-mono text-[#71717a] uppercase">
              {customAccent}
            </span>
          </div>
          <p className="text-[11px] text-[#71717a]">
            {t.accentTintDesc}
          </p>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {ACCENT_SWATCHES.map((swatch) => {
              const isAccentSelected = customAccent.toLowerCase() === swatch.color.toLowerCase();

              return (
                <button
                  key={swatch.name}
                  type="button"
                  onClick={() => handleChooseAccent(swatch.color)}
                  className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    isAccentSelected
                      ? 'bg-[#18181b] border-white/40 shadow-sm'
                      : 'bg-[#121215] border-[#27272a] hover:border-[#3f3f46]'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/30 shadow-inner flex items-center justify-center"
                    style={{ backgroundColor: swatch.color }}
                  >
                    {isAccentSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                  </span>
                  <span className="text-[10px] text-[#a1a1aa] truncate max-w-full font-mono">
                    {swatch.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* UI Density & Code Typography */}
        <div className="p-4 rounded-lg border border-[#27272a] bg-[#0c0c0e] space-y-3">
          <h4 className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-[#a78bfa]" style={{ color: customAccent }} />
            {t.typographyAndDensity}
          </h4>

          {/* Density Selection */}
          <div>
            <div className="text-[11px] text-[#a1a1aa] mb-1.5 font-medium">{t.uiDensityLabel}</div>
            <div className="grid grid-cols-3 gap-2">
              {(['compact', 'standard', 'relaxed'] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => setUiDensity(density)}
                  className={`px-2.5 py-1.5 rounded border text-xs font-mono capitalize transition-colors cursor-pointer ${
                    uiDensity === density
                      ? 'bg-[#18181b] text-[#fafafa] border-[#a78bfa] font-semibold'
                      : 'bg-[#121215] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa]'
                  }`}
                  style={{ borderColor: uiDensity === density ? customAccent : undefined }}
                >
                  {density === 'compact'
                    ? (language === 'zh-CN' ? '紧凑 (Compact)' : 'Compact')
                    : density === 'standard'
                    ? (language === 'zh-CN' ? '标准 (Standard)' : 'Standard')
                    : (language === 'zh-CN' ? '舒展 (Relaxed)' : 'Relaxed')}
                </button>
              ))}
            </div>
          </div>

          {/* Font Selection */}
          <div className="pt-2 border-t border-[#1e1e24]">
            <div className="text-[11px] text-[#a1a1aa] mb-1.5 font-medium">{t.editorFontLabel}</div>
            <div className="grid grid-cols-2 gap-2">
              {['Geist Mono', 'JetBrains Mono', 'Fira Code', 'IBM Plex Mono'].map((font) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => setEditorFont(font)}
                  className={`px-2.5 py-1.5 rounded border text-[11px] font-mono transition-colors cursor-pointer truncate ${
                    editorFont === font
                      ? 'bg-[#18181b] text-[#fafafa] border-[#a78bfa] font-semibold'
                      : 'bg-[#121215] text-[#71717a] border-[#27272a] hover:text-[#a1a1aa]'
                  }`}
                  style={{ borderColor: editorFont === font ? customAccent : undefined }}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: LIVE INTERACTIVE PREVIEW SANDBOX             */}
      {/* ======================================================== */}
      <div className="p-4 rounded-lg border border-[#27272a] bg-[#0c0c0e] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-[#fafafa] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#a78bfa]" style={{ color: customAccent }} />
            {t.livePreviewTitle} ({activeTheme.name})
          </h4>
          <span className="text-[10px] font-mono text-[#71717a]">
            Font: {editorFont} · {uiDensity}
          </span>
        </div>

        {/* Mock Component Canvas */}
        <div
          className="p-4 rounded-lg border space-y-3 font-mono text-xs transition-colors"
          style={{
            backgroundColor: activeTheme.background,
            borderColor: activeTheme.border,
            color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
          }}
        >
          {/* Mock Header */}
          <div
            className="p-2.5 rounded border flex items-center justify-between"
            style={{
              backgroundColor: activeTheme.cardBg,
              borderColor: activeTheme.border,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: customAccent }} />
              <span className="font-semibold" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                filesystem-server / read_file
              </span>
            </div>
            <span
              className="text-[10px] px-2 py-0.5 rounded border font-semibold"
              style={{
                backgroundColor: `${activeTheme.secondary}15`,
                borderColor: `${activeTheme.secondary}40`,
                color: activeTheme.secondary,
              }}
            >
              200 OK · 1.2ms
            </span>
          </div>

          {/* Mock Code Block */}
          <div
            className="p-3 rounded border text-[11px] leading-relaxed"
            style={{
              backgroundColor: activeTheme.mode === 'light' ? '#f1f5f9' : '#050507',
              borderColor: activeTheme.border,
              fontFamily: editorFont,
              color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
            }}
          >
            <span style={{ color: activeTheme.mode === 'light' ? '#64748b' : '#71717a' }}>// Orchestrator execution plan</span>
            <br />
            <span style={{ color: customAccent }}>const</span> session = await omp.dispatch({'{'}
            <br />
            &nbsp;&nbsp;tool: <span style={{ color: activeTheme.secondary }}>"/skills:deep-audit"</span>,
            <br />
            &nbsp;&nbsp;sandbox: <span className="text-[#38bdf8]">"gVisor-L3"</span>,
            <br />
            &nbsp;&nbsp;strictMemoryClamp: <span className="text-[#f59e0b]">true</span>
            <br />
            {'}'});
          </div>

          {/* Mock Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded text-xs font-semibold transition-opacity"
              style={{
                backgroundColor: customAccent,
                color: activeTheme.mode === 'light' ? '#ffffff' : '#09090b',
              }}
            >
              {t.mockPrimaryAction}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded border text-xs"
              style={{
                backgroundColor: activeTheme.cardBg,
                borderColor: activeTheme.border,
                color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
              }}
            >
              {t.mockSecondaryAction}
            </button>
            <span
              className="text-[10px] px-2 py-1 rounded border ml-auto"
              style={{
                backgroundColor: `${customAccent}10`,
                borderColor: `${customAccent}30`,
                color: customAccent,
              }}
            >
              {t.mockSubagentBadge}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 4: DISPLAY & STREAM PREFERENCES                  */}
      {/* ======================================================== */}
      <div className="p-4 rounded-lg border border-[#27272a] bg-[#0c0c0e] space-y-3">
        <h4 className="text-xs font-semibold text-[#fafafa] mb-2">{t.displayStreamToggles}</h4>

        <div className="space-y-3 divide-y divide-[#1e1e24]">
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-medium text-[#fafafa]">{t.toggleAutoScroll}</div>
              <div className="text-[11px] text-[#71717a]">
                {t.toggleAutoScrollDesc}
              </div>
            </div>
            <button
              onClick={() => setTerminalAutoScroll(!terminalAutoScroll)}
              className={`h-4 w-7 rounded-full border transition-colors relative cursor-pointer ${
                terminalAutoScroll ? 'bg-[#a78bfa] border-[#a78bfa]' : 'bg-[#18181b] border-[#3f3f46]'
              }`}
              style={{
                backgroundColor: terminalAutoScroll ? customAccent : undefined,
                borderColor: terminalAutoScroll ? customAccent : undefined,
              }}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-white transition-transform mt-[1px] ${
                  terminalAutoScroll ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-medium text-[#fafafa]">{t.toggleLatency}</div>
              <div className="text-[11px] text-[#71717a]">
                {t.toggleLatencyDesc}
              </div>
            </div>
            <button
              onClick={() => setShowLatency(!showLatency)}
              className={`h-4 w-7 rounded-full border transition-colors relative cursor-pointer ${
                showLatency ? 'bg-[#a78bfa] border-[#a78bfa]' : 'bg-[#18181b] border-[#3f3f46]'
              }`}
              style={{
                backgroundColor: showLatency ? customAccent : undefined,
                borderColor: showLatency ? customAccent : undefined,
              }}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-white transition-transform mt-[1px] ${
                  showLatency ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-medium text-[#fafafa]">{t.toggleGrid}</div>
              <div className="text-[11px] text-[#71717a]">
                {t.toggleGridDesc}
              </div>
            </div>
            <button
              onClick={() => setEnableGridBackground(!enableGridBackground)}
              className={`h-4 w-7 rounded-full border transition-colors relative cursor-pointer ${
                enableGridBackground ? 'bg-[#a78bfa] border-[#a78bfa]' : 'bg-[#18181b] border-[#3f3f46]'
              }`}
              style={{
                backgroundColor: enableGridBackground ? customAccent : undefined,
                borderColor: enableGridBackground ? customAccent : undefined,
              }}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-white transition-transform mt-[1px] ${
                  enableGridBackground ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-medium text-[#fafafa]">{t.toggleGlow}</div>
              <div className="text-[11px] text-[#71717a]">
                {t.toggleGlowDesc}
              </div>
            </div>
            <button
              onClick={() => setEnableGlowEffects(!enableGlowEffects)}
              className={`h-4 w-7 rounded-full border transition-colors relative cursor-pointer ${
                enableGlowEffects ? 'bg-[#a78bfa] border-[#a78bfa]' : 'bg-[#18181b] border-[#3f3f46]'
              }`}
              style={{
                backgroundColor: enableGlowEffects ? customAccent : undefined,
                borderColor: enableGlowEffects ? customAccent : undefined,
              }}
            >
              <span
                className={`block h-3 w-3 rounded-full bg-white transition-transform mt-[1px] ${
                  enableGlowEffects ? 'translate-x-3 bg-[#09090b]' : 'translate-x-0.5 bg-[#71717a]'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
