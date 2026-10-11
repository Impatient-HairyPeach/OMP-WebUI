import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  Globe,
  Keyboard,
  Layers,
  Maximize2,
  Minimize2,
  Palette,
  RefreshCw,
  RotateCcw,
  Shield,
  Sliders,
  Sparkles,
  Terminal,
  Type,
} from 'lucide-react';
import { ThemeOption } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../context/I18nContext';
import { PALETTES, paletteById, type PalettePreference } from '../../lib/palettes';
import {
  alertTurnComplete,
  loadAlertPrefs,
  notificationState,
  playChime,
  requestNotificationPermission,
  saveAlertPref,
  type AlertKind,
  type NotificationState,
} from '../../lib/alerts';
import {
  SHORTCUTS,
  bindingOf,
  defaultShortcuts,
  displayBinding,
  loadShortcuts,
  saveShortcuts,
  type ShortcutAction,
  type ShortcutMap,
} from '../../lib/shortcuts';

interface ThemeViewProps {
  onSelectAccentColor?: (color: string) => void;
}



export const ACCENT_SWATCHES = [
  { name: 'omp Magenta', color: '#ec5bab' },
  { name: 'omp Cyan', color: '#7dd7e8' },
  { name: 'Classic Blue', color: '#0969da' },
  { name: 'Soft Violet', color: '#a78bfa' },
  { name: 'Electric Cyan', color: '#38bdf8' },
  { name: 'Emerald', color: '#34d399' },
  { name: 'Rose', color: '#fb7185' },
  { name: 'Amber Gold', color: '#fbbf24' },
  { name: 'Sunset Orange', color: '#fb923c' },
  { name: 'Indigo', color: '#818cf8' },
  { name: 'Neon Lime', color: '#a3e635' },
];

export const ThemeView: React.FC<ThemeViewProps> = ({ onSelectAccentColor }) => {
  const {
    theme: activeTheme,
    customPalette,
    saveCustomPalette,
    accentColor: activeAccentColor,
    setAccentColor,
    paletteId,
    setPaletteId,
    resolvedPalette,
    uiDensity,
    setUiDensity,
    editorFont,
    setEditorFont,
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
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => loadShortcuts());
  const [alerts, setAlerts] = useState(() => loadAlertPrefs());
  const [notifyState, setNotifyState] = useState<NotificationState>(() => notificationState());

  const setAlert = (kind: AlertKind, enabled: boolean) => {
    const next = { ...alerts, [kind]: enabled };
    setAlerts(next);
    saveAlertPref(kind, enabled);
  };
  /** Action currently capturing the next key press. */
  const [recording, setRecording] = useState<ShortcutAction | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(null);
        return;
      }
      // Backspace/Delete clears the shortcut (same as the ✕ button).
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const cleared = { ...loadShortcuts(), [recording]: '' } as ShortcutMap;
        setShortcuts(cleared);
        saveShortcuts(cleared);
        setRecording(null);
        return;
      }
      const binding = bindingOf(event);
      if (!binding) return;
      const next = { ...loadShortcuts(), [recording]: binding } as ShortcutMap;
      setShortcuts(next);
      saveShortcuts(next);
      setRecording(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [recording]);
  const [customSecondary, setCustomSecondary] = useState(activeTheme.secondary || '#34d399');
  const [customTextColor, setCustomTextColor] = useState(activeTheme.text || '#fafafa');
  const [customTextMuted, setCustomTextMuted] = useState(activeTheme.textMuted || '#a1a1aa');
  const [customAppliedNotice, setCustomAppliedNotice] = useState(false);

  const handleSaveAndApplyCustomTheme = () => {
    saveCustomPalette({
      mode: customMode === 'light' ? 'light' : 'dark',
      bg: customBg,
      panel: customCard,
      border: customBorder,
      text: customTextColor,
      textMuted: customTextMuted,
      accent: customAccent,
    });
    onSelectAccentColor?.(customAccent);
    setCustomAppliedNotice(true);
    setTimeout(() => setCustomAppliedNotice(false), 2500);
  };

  const handleResetCustomTheme = () => {
    setAccentColor('');
    setPaletteId(customPalette ? 'custom' : 'dark');
  };

  const handleChooseAccent = (color: string) => {
    setAccentColor(color);
    onSelectAccentColor?.(color);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272a] pb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#fafafa] flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#a78bfa]" style={{ color: customAccent }} />
            {t.uiThemeStudio}
          </h2>
          <p className="text-xs text-[#a1a1aa] mt-0.5">
            {t.uiThemeDesc}
          </p>
        </div>

      </div>

      {/* ======================================================== */}
      {/* SECTION: THEME (跟随系统 · 深色 · 浅色 · 自定义)          */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-lg border space-y-3 transition-colors"
        style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
              {language === 'zh-CN' ? '配色方案' : 'Palette'}
            </div>
          </div>
          <span className="text-[10px] font-mono text-[#71717a] shrink-0">{paletteId}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['auto', 'dark', 'light', 'custom'] as PalettePreference[]).map((id) => {
            const isActive = paletteId === id;
            const definition = id === 'dark' || id === 'light' ? paletteById(id) : null;
            const base = id === 'custom' ? paletteById(resolvedPalette) : definition;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPaletteId(id)}
                className={`flex items-center justify-between gap-2 p-2.5 rounded border text-[10px] transition-colors cursor-pointer ${
                  isActive ? 'font-semibold' : ''
                }`}
                style={{
                  backgroundColor: base ? base.bg : activeTheme.cardBg,
                  borderColor: isActive ? activeTheme.accent : activeTheme.border,
                  color: base ? base.text : undefined,
                }}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full border shrink-0"
                    style={{
                      backgroundColor: id === 'custom' ? activeAccentColor : base?.accent ?? activeTheme.accent,
                      borderColor: base?.border ?? activeTheme.border,
                    }}
                  />
                  <span className="truncate">
                    {id === 'auto'
                      ? language === 'zh-CN'
                        ? '跟随系统'
                        : 'Auto'
                      : id === 'custom'
                      ? language === 'zh-CN'
                        ? '自定义'
                        : 'Custom'
                      : language === 'zh-CN'
                      ? definition!.label.zh
                      : definition!.label.en}
                  </span>
                </span>
                {isActive && <span className="text-[9px] opacity-70 shrink-0">{language === 'zh-CN' ? '当前' : 'on'}</span>}
              </button>
            );
          })}
        </div>

        {paletteId === 'custom' && (
          <p className="text-[10px] text-[#71717a]">
            {language === 'zh-CN'
              ? `自定义沿用「${resolvedPalette === 'light' ? '浅色' : '深色'}」的底色，强调色取下方所选颜色。`
              : `Custom keeps the ${resolvedPalette === 'light' ? 'light' : 'dark'} base and uses the accent chosen below.`}
          </p>
        )}
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
            <p className="text-[10px] mt-0.5" style={{ color: activeTheme.mode === 'light' ? '#64748b' : '#71717a' }}>
              {t.languageSelectDesc}
            </p>
          </div>

          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value === 'en-US' ? 'en-US' : 'zh-CN')}
            aria-label={t.languageSelect}
            className="h-8 px-2.5 rounded border text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#a78bfa]"
            style={{
              backgroundColor: activeTheme.mode === 'light' ? '#ffffff' : '#121215',
              borderColor: activeTheme.border,
              color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa',
            }}
          >
            <option value="zh-CN">简体中文</option>
            <option value="en-US">English (US)</option>
          </select>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ======================================================== */}
      {/* SECTION 1.2: KEYBOARD SHORTCUTS (快捷键)                  */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-lg border space-y-3 transition-colors"
        style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
      >
        <div className="flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: activeTheme.border }}>
          <div>
            <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
              <Keyboard className="w-4 h-4" style={{ color: customAccent }} />
              {language === 'zh-CN' ? '快捷键' : 'Shortcuts'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const defaults = defaultShortcuts();
              setShortcuts(defaults);
              saveShortcuts(defaults);
              setRecording(null);
            }}
            title={language === 'zh-CN' ? '全部恢复默认' : 'Reset every binding'}
            className="text-[10px] px-2 py-1 rounded border cursor-pointer transition-colors shrink-0"
            style={{ borderColor: activeTheme.border, color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}
          >
            <span className="flex items-center gap-1">
              <RotateCcw className="w-3 h-3" />
              {language === 'zh-CN' ? '恢复默认' : 'Reset'}
            </span>
          </button>
        </div>

        <div className="space-y-2">
          {SHORTCUTS.map((def) => {
            const binding = shortcuts[def.action];
            const isRecording = recording === def.action;
            return (
              <div key={def.action} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                    {language === 'zh-CN' ? def.label.zh : def.label.en}
                  </div>
                  <div className="text-[10px] text-[#71717a] truncate">
                    {language === 'zh-CN' ? def.detail.zh : def.detail.en}
                  </div>
                </div>
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setRecording(isRecording ? null : def.action)}
                    title={
                      isRecording
                        ? language === 'zh-CN'
                          ? '按下新的组合键（Esc 取消，Backspace 关闭）'
                          : 'Press the new combination (Esc cancels, Backspace disables)'
                        : language === 'zh-CN'
                        ? '点击后按下新的组合键；Backspace 或 ✕ 关闭该快捷键'
                        : 'Click, then press the new combination; Backspace or ✕ disables it'
                    }
                    className={`px-2.5 py-1 rounded border text-[10px] font-mono cursor-pointer transition-colors ${
                      isRecording ? 'animate-pulse' : ''
                    }`}
                    style={{
                      borderColor: isRecording ? customAccent : activeTheme.border,
                      color: isRecording
                        ? customAccent
                        : binding
                        ? activeTheme.mode === 'light'
                          ? '#334155'
                          : '#d4d4d8'
                        : '#71717a',
                      backgroundColor: isRecording ? `${customAccent}1a` : 'transparent',
                    }}
                  >
                    {isRecording
                      ? language === 'zh-CN'
                        ? '按下组合键…'
                        : 'press keys…'
                      : binding
                      ? displayBinding(binding)
                      : language === 'zh-CN'
                      ? '已关闭'
                      : 'off'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...loadShortcuts(), [def.action]: '' } as ShortcutMap;
                      setShortcuts(next);
                      saveShortcuts(next);
                      setRecording(null);
                    }}
                    disabled={!binding}
                    title={language === 'zh-CN' ? '关闭该快捷键（留空）' : 'Disable this shortcut (leave empty)'}
                    className="px-1.5 py-1 rounded border text-[10px] cursor-pointer transition-colors disabled:opacity-30"
                    style={{ borderColor: activeTheme.border, color: '#71717a' }}
                  >
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[#52525b]">
          {language === 'zh-CN'
            ? 'Ctrl 在 macOS 上即 ⌘；输入框内的裸按键仍按输入处理。'
            : 'Ctrl means ⌘ on macOS; modifier-free bindings still type normally in fields.'}
        </p>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1.3: COMPLETION ALERTS (完成提醒)                 */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-lg border space-y-3 transition-colors"
        style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
      >
        <div className="border-b pb-3" style={{ borderColor: activeTheme.border }}>
          <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
            <Bell className="w-4 h-4" style={{ color: customAccent }} />
            {language === 'zh-CN' ? '完成提醒' : 'Completion alerts'}
          </div>
          <div className="text-[10px] text-[#71717a] mt-0.5">
            {language === 'zh-CN'
              ? '模型回复结束后提醒你；窗口在前台时不打扰（可用右侧按钮立即测试）。'
              : 'Fires when a turn finishes; stays quiet while the window is focused (use the test buttons).'}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                {language === 'zh-CN' ? '浏览器消息提示' : 'Desktop notification'}
              </div>
              <div className="text-[10px] text-[#71717a] truncate">
                {notifyState === 'unsupported'
                  ? language === 'zh-CN'
                    ? '此浏览器不支持系统通知'
                    : 'this browser has no Notification API'
                  : notifyState === 'granted'
                  ? language === 'zh-CN'
                    ? '已授权'
                    : 'permission granted'
                  : notifyState === 'denied'
                  ? language === 'zh-CN'
                    ? '已被拒绝，需在浏览器设置里恢复'
                    : 'denied: re-enable it in the browser settings'
                  : language === 'zh-CN'
                  ? '点击开关时会请求授权'
                  : 'the switch asks for permission'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={notifyState !== 'granted'}
                onClick={() => alertTurnComplete({ title: 'OMP WebUI', body: language === 'zh-CN' ? '这是一条测试通知' : 'This is a test notification', force: true })}
                className="text-[10px] px-2 py-1 rounded border cursor-pointer disabled:opacity-40"
                style={{ borderColor: activeTheme.border, color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}
              >
                {language === 'zh-CN' ? '测试' : 'Test'}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={alerts.desktop}
                onClick={async () => {
                  const next = !alerts.desktop;
                  if (next && notifyState === 'default') {
                    const state = await requestNotificationPermission();
                    setNotifyState(state);
                    if (state !== 'granted') return;
                  }
                  if (next && notifyState === 'denied') return;
                  setAlert('desktop', next);
                }}
                className={`w-9 h-5 rounded-full border transition-colors cursor-pointer shrink-0 ${
                  alerts.desktop ? '' : 'bg-transparent'
                }`}
                style={{
                  backgroundColor: alerts.desktop ? customAccent : 'transparent',
                  borderColor: alerts.desktop ? customAccent : activeTheme.border,
                }}
                title={alerts.desktop ? (language === 'zh-CN' ? '已开启' : 'on') : language === 'zh-CN' ? '已关闭' : 'off'}
              >
                <span
                  className="block w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: alerts.desktop ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-medium" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
                {language === 'zh-CN' ? '声音提醒' : 'Sound alert'}
              </div>
              <div className="text-[10px] text-[#71717a] truncate">
                {language === 'zh-CN' ? '两音提示音（WebAudio 合成，不下载资源）' : 'two-tone chime, synthesized (no download)'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => playChime()}
                className="text-[10px] px-2 py-1 rounded border cursor-pointer"
                style={{ borderColor: activeTheme.border, color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}
              >
                {language === 'zh-CN' ? '试听' : 'Play'}
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={alerts.sound}
                onClick={() => setAlert('sound', !alerts.sound)}
                className="w-9 h-5 rounded-full border transition-colors cursor-pointer shrink-0"
                style={{
                  backgroundColor: alerts.sound ? customAccent : 'transparent',
                  borderColor: alerts.sound ? customAccent : activeTheme.border,
                }}
                title={alerts.sound ? (language === 'zh-CN' ? '已开启' : 'on') : language === 'zh-CN' ? '已关闭' : 'off'}
              >
                <span
                  className="block w-4 h-4 rounded-full bg-white transition-transform"
                  style={{ transform: alerts.sound ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1.5: CUSTOM THEME STUDIO (自定义主题工作区)      */}
      {/* ======================================================== */}
      <div
        className="p-4 rounded-lg border space-y-4 transition-colors"
        style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.border }}
      >
        <div className="flex flex-col gap-1 border-b pb-3" style={{ borderColor: activeTheme.border }}>
          <h3 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: activeTheme.mode === 'light' ? '#0f172a' : '#fafafa' }}>
            <Palette className="w-4 h-4" style={{ color: customAccent }} />
            {t.customTheme}
          </h3>
        </div>

        {/* Custom Theme Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Col 1: Basic Info & Mode */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
              <label className="block text-[10px] font-medium mb-1" style={{ color: activeTheme.mode === 'light' ? '#334155' : '#a1a1aa' }}>
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
          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in motion-reduce:animate-none">
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
          <p className="text-[10px] text-[#71717a]">
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

            {/* Any colour, not just the curated swatches */}
            <label
              className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                ACCENT_SWATCHES.some((swatch) => swatch.color.toLowerCase() === customAccent.toLowerCase())
                  ? 'bg-[#121215] border-[#27272a] hover:border-[#3f3f46]'
                  : 'bg-[#18181b] border-white/40 shadow-sm'
              }`}
              title={language === 'zh-CN' ? '自定义颜色' : 'Custom colour'}
            >
              <input
                type="color"
                value={customAccent}
                onChange={(event) => handleChooseAccent(event.target.value)}
                className="w-4 h-4 rounded-full border border-black/30 bg-transparent cursor-pointer p-0"
                aria-label={language === 'zh-CN' ? '自定义主题色调' : 'Custom accent colour'}
              />
              <span className="text-[10px] text-[#a1a1aa] truncate max-w-full font-mono">
                {language === 'zh-CN' ? '自定义' : 'custom'}
              </span>
            </label>
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
            <div className="text-[10px] text-[#a1a1aa] mb-1.5 font-medium">{t.uiDensityLabel}</div>
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
            <div className="text-[10px] text-[#a1a1aa] mb-1.5 font-medium">{t.editorFontLabel}</div>
            <div className="grid grid-cols-2 gap-2">
              {['System Mono', 'Consolas', 'Cascadia Mono', 'Menlo', 'Courier New'].map((font) => (
                <button
                  key={font}
                  type="button"
                  onClick={() => setEditorFont(font)}
                  className={`px-2.5 py-1.5 rounded border text-[10px] font-mono transition-colors cursor-pointer truncate ${
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
            className="p-3 rounded border text-[10px] leading-relaxed"
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
              <div className="text-[10px] text-[#71717a]">
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
              <div className="text-[10px] text-[#71717a]">
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
              <div className="text-xs font-medium text-[#fafafa]">{t.toggleGlow}</div>
              <div className="text-[10px] text-[#71717a]">
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
