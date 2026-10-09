/**
 * Keyboard shortcuts: one binding per action, stored as `Ctrl+Alt+B` style
 * strings so they survive a reload and stay readable in the settings UI.
 * `Ctrl` means "Ctrl on Windows/Linux, ⌘ on macOS" — the same convention the
 * command palette already uses.
 */

export type ShortcutAction = 'toggleLeft' | 'toggleRight' | 'search';

export interface ShortcutDef {
  action: ShortcutAction;
  label: { zh: string; en: string };
  detail: { zh: string; en: string };
  defaultBinding: string;
}

export const SHORTCUT_STORAGE_KEY = 'omp-studio:shortcuts';

export const SHORTCUTS: ShortcutDef[] = [
  {
    action: 'toggleLeft',
    label: { zh: '左侧面板', en: 'Left panel' },
    detail: { zh: '展开 / 折叠会话面板', en: 'Expand or collapse the session panel' },
    defaultBinding: 'Ctrl+B',
  },
  {
    action: 'toggleRight',
    label: { zh: '右侧面板', en: 'Right panel' },
    detail: { zh: '展开 / 折叠文件与 Git 面板', en: 'Expand or collapse the files & git panel' },
    defaultBinding: 'Ctrl+Alt+B',
  },
  {
    action: 'search',
    label: { zh: '搜索', en: 'Search' },
    detail: { zh: '打开左侧面板并聚焦会话搜索', en: 'Open the left panel and focus session search' },
    defaultBinding: 'Ctrl+F',
  },
];

export type ShortcutMap = Record<ShortcutAction, string>;

export function defaultShortcuts(): ShortcutMap {
  return SHORTCUTS.reduce((map, def) => {
    map[def.action] = def.defaultBinding;
    return map;
  }, {} as ShortcutMap);
}

export function loadShortcuts(): ShortcutMap {
  const defaults = defaultShortcuts();
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(SHORTCUT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ShortcutMap>;
    for (const def of SHORTCUTS) {
      // An empty string is a stored value too: it means "this shortcut is off".
      if (typeof parsed[def.action] === 'string') defaults[def.action] = parsed[def.action]!;
    }
    return defaults;
  } catch {
    return defaults;
  }
}

export function saveShortcuts(map: ShortcutMap): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHORTCUT_STORAGE_KEY, JSON.stringify(map));
}

/** Canonical `Ctrl+Alt+B` form of a key event, or null for modifier-only presses. */
export function bindingOf(event: KeyboardEvent): string | null {
  const key = event.key;
  if (!key || key === 'Control' || key === 'Meta' || key === 'Alt' || key === 'Shift' || key === 'AltGraph') return null;
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}

function canonical(binding: string, event: KeyboardEvent): string | null {
  const parts = binding.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  const out: string[] = [];
  if (mods.has('ctrl') || mods.has('cmd') || mods.has('meta') || mods.has('mod')) {
    if (event.ctrlKey || event.metaKey) out.push('Ctrl');
    else return null;
  } else if (event.ctrlKey || event.metaKey) {
    return null;
  }
  for (const name of ['Alt', 'Shift'] as const) {
    if (mods.has(name.toLowerCase())) {
      if (name === 'Alt' ? !event.altKey : !event.shiftKey) return null;
      out.push(name);
    }
  }
  if (mods.has('alt') ? !event.altKey : event.altKey) {
    if (!mods.has('alt')) return null;
  }
  if (mods.has('shift') ? !event.shiftKey : event.shiftKey) {
    if (!mods.has('shift')) return null;
  }
  out.push(key.length === 1 ? key.toUpperCase() : key);
  return out.join('+');
}

/** True when `event` fires `binding` (Ctrl == Cmd, modifiers must match exactly). */
export function matchesBinding(binding: string, event: KeyboardEvent): boolean {
  if (!binding.trim()) return false; // cleared binding = shortcut off
  const wanted = canonical(binding, event);
  if (!wanted) return false;
  const actual = bindingOf(event);
  return actual === wanted;
}

/** Platform-aware label: ⌘ on macOS, Ctrl elsewhere. */
export function displayBinding(binding: string): string {
  if (typeof navigator === 'undefined') return binding;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  return binding
    .split('+')
    .map((part) => (part === 'Ctrl' && mac ? '⌘' : part))
    .join(mac ? '' : '+');
}
