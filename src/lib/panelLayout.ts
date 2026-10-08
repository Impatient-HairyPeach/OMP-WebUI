/**
 * Panel geometry: clamp/load/persist helpers for the resizable surfaces of the
 * workspace (session sidebar, side panel, settings sidebar) and the composer.
 * Widths/sizes live in localStorage because they are UI preferences, not omp
 * session state.
 */

export interface PanelSizeConfig {
  min: number;
  max: number;
  defaultSize: number;
}

/** Left session list inside the workspace. */
export const SESSION_PANEL: PanelSizeConfig & { storageKey: string } = {
  storageKey: 'omp-studio:session-panel-width',
  min: 200,
  max: 520,
  defaultSize: 256,
};

/** Right auxiliary panel (side chat / task / git). */
export const SIDE_PANEL: PanelSizeConfig & { storageKey: string } = {
  storageKey: 'omp-studio:side-panel-width',
  min: 280,
  max: 760,
  defaultSize: 384,
};

/** Settings navigation sidebar. */
export const SETTINGS_PANEL: PanelSizeConfig & { storageKey: string } = {
  storageKey: 'omp-studio:settings-panel-width',
  min: 180,
  max: 420,
  defaultSize: 240,
};

/** Composer textarea height (user-dragged; kept across sessions). */
export const COMPOSER_BOX: PanelSizeConfig & { storageKey: string } = {
  storageKey: 'omp-studio:composer-height',
  min: 64,
  max: 560,
  defaultSize: 88,
};

/** Project folders expanded in the session list (JSON array of directory paths). */
export const EXPANDED_PROJECTS_KEY = 'omp-studio:expanded-projects';

/** Project folders removed from the session list (sessions stay on disk). */
export const HIDDEN_PROJECTS_KEY = 'omp-studio:hidden-projects';

export function clampPanelSize(value: number, config: PanelSizeConfig): number {
  if (!Number.isFinite(value)) return config.defaultSize;
  return Math.min(config.max, Math.max(config.min, Math.round(value)));
}

export function loadPanelSize(config: PanelSizeConfig & { storageKey: string }): number {
  if (typeof window === 'undefined') return config.defaultSize;
  try {
    const raw = window.localStorage.getItem(config.storageKey);
    if (raw === null) return config.defaultSize;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return config.defaultSize;
    return clampPanelSize(parsed, config);
  } catch {
    return config.defaultSize;
  }
}

export function savePanelSize(storageKey: string, size: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, String(Math.round(size)));
  } catch {
    // storage unavailable — the preference simply won't persist
  }
}

/** Stable key for a project directory (`D:\a\` and `D:\a` are the same folder). */
export function comparableDirKey(directory: string): string {
  const normalized = directory.replace(/\\/g, '/').replace(/\/+$/, '');
  return /^[a-zA-Z]:/.test(normalized) || normalized.startsWith('//') ? normalized.toLowerCase() : normalized;
}

export function loadExpandedProjects(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EXPANDED_PROJECTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string').map(comparableDirKey);
  } catch {
    return [];
  }
}

export function saveExpandedProjects(keys: Iterable<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(EXPANDED_PROJECTS_KEY, JSON.stringify([...keys]));
  } catch {
    // storage unavailable — the preference simply won't persist
  }
}

function readKeys(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string').map(comparableDirKey);
  } catch {
    return [];
  }
}

function writeKeys(key: string, values: Iterable<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    // storage unavailable — the preference simply won't persist
  }
}

export function loadHiddenProjects(): string[] {
  return readKeys(HIDDEN_PROJECTS_KEY);
}

export function saveHiddenProjects(keys: Iterable<string>): void {
  writeKeys(HIDDEN_PROJECTS_KEY, keys);
}
