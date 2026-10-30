// This device's preferences (the theme lives in theme.svelte.ts, which boot.js mirrors before first
// paint), the recent tracks, and what's open right now.

export type Language = 'system' | 'en' | 'de';
export type Mode = 'keep' | 'resample';

interface Prefs {
  language: Language;
  /** What happens to the key when the tempo changes. Keep key unless picked otherwise. */
  mode: Mode;
  kick: boolean;
  loopBars: 4 | 8 | 16;
  /** The last target tempo: the next track opens at it, so a session at 140 stays at 140. */
  target: number | null;
  /** The waveform's zoom, an index into ZOOM. */
  zoom: number;
}

const KEY = 'pitcher:prefs';
const DEFAULTS: Prefs = { language: 'system', mode: 'keep', kick: false, loopBars: 8, target: null, zoom: 2 };

/**
 * The waveform's zoom in pixels per beat, so the beat grid looks the same for every track and a wider
 * screen shows more of the track rather than a bigger one: 77 px a beat is about 11 bars on 3440 px.
 */
export const ZOOM = [160, 110, 77, 55, 38, 26, 18] as const;

/** −1 zooms out, +1 in. */
export function zoomBy(step: number) {
  prefs.zoom = Math.max(0, Math.min(ZOOM.length - 1, prefs.zoom - step));
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export const prefs = $state<Prefs>(load(KEY, { ...DEFAULTS }));

/** What's open: the settings sheet. */
export const ui = $state({ settings: false });

export interface Recent {
  id: string;
  title: string;
  channel: string;
  tempo: number;
  shift: number;
  mode: Mode;
  at: number;
}

const RECENT_KEY = 'pitcher:recent';
const MAX_RECENT = 8;

function loadRecent(): Recent[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => typeof r?.id === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export const recent = $state<{ list: Recent[] }>({ list: loadRecent() });

/** Puts a track at the top of the list, with its latest settings. */
export function remember(entry: Omit<Recent, 'at'>) {
  recent.list = [{ ...entry, at: Date.now() }, ...recent.list.filter((r) => r.id !== entry.id)].slice(0, MAX_RECENT);
}

export function forget(id: string) {
  recent.list = recent.list.filter((r) => r.id !== id);
}

$effect.root(() => {
  $effect(() => {
    const snapshot = JSON.stringify(prefs);
    try {
      localStorage.setItem(KEY, snapshot);
    } catch {}
  });
  $effect(() => {
    const snapshot = JSON.stringify(recent.list);
    try {
      localStorage.setItem(RECENT_KEY, snapshot);
    } catch {}
  });
});
