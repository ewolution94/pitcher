// The settings in the address (so a reload or a sent link opens the same test) and as text for the
// DAW. Pure functions; the session keeps the address up to date.

import type { Mode } from './prefs.svelte.ts';
import { fromUrl } from './yt/url.ts';
import { formatPercent, formatShift, keyName, transpose, type Key } from './music.ts';

export interface Settings {
  tempo?: number;
  shift?: number;
  mode?: Mode;
}

/** A video and its settings from an address: /?v=…&bpm=128&st=1&mode=resample, /watch?v=…, youtu.be paths. */
export function readAddress(url: URL): { id: string | null; settings: Settings } {
  const target = fromUrl(url);
  const p = url.searchParams;
  const settings: Settings = {};
  const bpm = Number(p.get('bpm'));
  if (bpm >= 40 && bpm <= 250) settings.tempo = bpm;
  const st = Number(p.get('st'));
  if (p.has('st') && Number.isFinite(st) && Math.abs(st) <= 12) settings.shift = st;
  const mode = p.get('mode');
  if (mode === 'resample' || mode === 'keep') settings.mode = mode;
  // Pitcher's own addresses put the video on the root (/?v=…), which YouTube's paths don't.
  const v = p.get('v');
  const id = target?.kind === 'video' ? target.id : v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null;
  return { id, settings };
}

const round = (n: number, digits: number) => String(Math.round(n * 10 ** digits) / 10 ** digits);

/** The path and query for a video at these settings. */
export function addressFor(id: string, s: Required<Settings>): string {
  const q = new URLSearchParams({ v: id, bpm: round(s.tempo, 2) });
  if (s.mode === 'resample') q.set('mode', 'resample');
  else if (Math.abs(s.shift) >= 0.005) q.set('st', round(s.shift, 2));
  return `/?${q}`;
}

export interface Summary {
  title: string;
  channel: string;
  source: number;
  base: number;
  tempo: number;
  key: Key;
  shift: number;
  mode: Mode;
  link: string | null;
}

/** What Copy puts on the clipboard: everything the DAW needs, and the link back. */
export function summaryText(s: Summary): string {
  const ratio = s.tempo / s.base;
  const lines = [s.channel ? `${s.title} – ${s.channel}` : s.title];
  const read = s.base !== s.source ? ` (read as ${round(s.base, 1)})` : '';
  const target = transpose(s.key, s.shift);
  const keyPart = Math.abs(s.shift) < 0.005 ? keyName(s.key) : `${keyName(s.key)} → ${keyName(target)} (${formatShift(s.shift)})`;
  lines.push(
    `${s.source.toFixed(1)}${read} → ${s.tempo.toFixed(1)} BPM (${formatPercent(ratio, 2)}) · ${keyPart} · ${s.mode === 'resample' ? 'Resample' : 'Keep key'}`,
  );
  if (s.link) lines.push(s.link);
  return lines.join('\n');
}
