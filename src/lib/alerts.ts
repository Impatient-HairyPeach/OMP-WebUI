/**
 * Completion alerts: a desktop notification and a short synthesized chime for
 * when a turn finishes. Both are opt-in in Settings, both are gated on the
 * window being in the background (the point of an alert is that you looked
 * away), and the sound is generated with WebAudio so nothing is downloaded.
 */

export type AlertKind = 'desktop' | 'sound';

const STORAGE_KEYS: Record<AlertKind, string> = {
  desktop: 'omp-studio:alert-desktop',
  sound: 'omp-studio:alert-sound',
};

export interface AlertPrefs {
  desktop: boolean;
  sound: boolean;
}

export function loadAlertPrefs(): AlertPrefs {
  if (typeof window === 'undefined') return { desktop: false, sound: false };
  return {
    desktop: window.localStorage.getItem(STORAGE_KEYS.desktop) === 'true',
    sound: window.localStorage.getItem(STORAGE_KEYS.sound) === 'true',
  };
}

export function saveAlertPref(kind: AlertKind, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEYS[kind], String(enabled));
}

export type NotificationState = 'granted' | 'denied' | 'default' | 'unsupported';

export function notificationState(): NotificationState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationState> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Two-tone chime (A5 → E6) with a soft envelope; ~0.35s, no asset needed. */
export function playChime(): void {
  if (typeof window === 'undefined') return;
  // Safari still ships the constructor under a prefixed name the DOM lib omits,
  // so the guard checks the runtime shape and the cast is named with its reason.
  const prefixedAudioContext =
    'webkitAudioContext' in window && typeof window.webkitAudioContext === 'function'
      ? (window.webkitAudioContext as unknown as typeof AudioContext)
      : undefined;
  const Ctor = typeof window.AudioContext === 'function' ? window.AudioContext : prefixedAudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
    gain.connect(ctx.destination);
    const notes = [
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.14 },
    ];
    for (const note of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      osc.connect(gain);
      osc.start(ctx.currentTime + note.at);
      osc.stop(ctx.currentTime + note.at + 0.24);
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
  } catch {
    // Audio is a nicety: a blocked or unavailable context is not an error.
  }
}

/** True while the window is not the one the user is looking at. */
export function windowInBackground(): boolean {
  if (typeof document === 'undefined') return false;
  return document.hidden || !document.hasFocus();
}

export interface TurnAlert {
  title: string;
  body: string;
  /** Fire even when the window is focused (used by the Settings test buttons). */
  force?: boolean;
}

/** Fire the enabled alerts; returns what actually happened, for logging/tests. */
export function alertTurnComplete({ title, body, force = false }: TurnAlert): { desktop: boolean; sound: boolean; skipped: boolean } {
  const prefs = loadAlertPrefs();
  const background = windowInBackground();
  if (!prefs.desktop && !prefs.sound) return { desktop: false, sound: false, skipped: true };
  if (!background && !force) return { desktop: false, sound: false, skipped: true };

  let desktop = false;
  if (prefs.desktop && notificationState() === 'granted') {
    try {
      const notification = new Notification(title, { body, tag: 'omp-turn', silent: true });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      desktop = true;
    } catch {
      desktop = false;
    }
  }
  if (prefs.sound) {
    playChime();
  }
  return { desktop, sound: prefs.sound, skipped: false };
}
